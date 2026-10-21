package uz.safekid.devicecontrol

import android.content.Context
import android.os.BatteryManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/** Talks to the backend on behalf of the device (heartbeat, policy sync, commands, alerts). */
class SyncEngine(private val context: Context) {
  private val session = DeviceSession.get(context)
  private val store get() = session.store

  /** Heartbeat; follows up with a full sync when the server has something new. */
  fun heartbeat() {
    val permissions = Permissions.status(context)
    val body = JSONObject()
      .put("appliedPolicyVersion", store.appliedPolicyVersion() ?: JSONObject.NULL)
      .put("permissionStatus", JSONObject(permissions))
      .put("appVersion", appVersion())
      .put("enforcementActive", Permissions.isAccessibilityEnabled(context))
      .put("inOtherSpace", SpaceWatcher.isInOtherSpace(context))
    batteryLevel()?.let { body.put("batteryLevel", it) }

    val res = session.request("POST", "/device/heartbeat", body)
    if (res.code in 200..299) lastHeartbeatOkAt = System.currentTimeMillis()
    val json = res.body ?: return
    val latest = json.optInt("latestPolicyVersion", 0)
    if (latest > (store.appliedPolicyVersion() ?: 0) || json.optBoolean("hasPendingCommands")) syncNow()
  }

  /** Pulls policy + pending commands, applies them and acknowledges. */
  @Synchronized
  fun syncNow() {
    val state = session.request("GET", "/device/state").body ?: return
    val policyJson = state.getJSONObject("policy")
    val incoming = policyJson.getInt("version")
    if (incoming != store.appliedPolicyVersion()) applyPolicy(policyJson)

    val commands = state.optJSONArray("pendingCommands") ?: JSONArray()
    for (i in 0 until commands.length()) {
      val command = commands.getJSONObject(i)
      val result = runCatching { execute(command.getString("type")) }
      val ack = JSONObject().put("status", if (result.isSuccess) "applied" else "failed")
      result.exceptionOrNull()?.let { ack.put("error", (it.message ?: "error").take(500)) }
      session.request("POST", "/device/commands/${command.getString("id")}/ack", ack)
    }
  }

  fun applyPolicy(json: JSONObject) {
    val policy = store.savePolicy(json)
    DeviceEvents.emitPolicyApplied(policy.version)
    runCatching { session.request("POST", "/device/policy/ack", JSONObject().put("version", policy.version)) }
      .onFailure { Log.w(TAG, "Policy ack failed; heartbeat will report it", it) }
  }

  private fun execute(type: String) {
    when (type) {
      "SYNC_NOW" -> Unit
      "REPORT_APPS" -> reportApps()
      "REFRESH_PERMISSIONS" -> heartbeat()
      else -> throw IllegalArgumentException("Unsupported command $type")
    }
  }

  fun reportApps() {
    val apps = JSONArray()
    InstalledApps.list(context).take(2000).forEach {
      apps.put(JSONObject().put("appId", it.appId).put("label", it.label).put("isSystem", it.isSystem))
    }
    session.request("PUT", "/device/apps", JSONObject().put("apps", apps))
  }

  fun reportAlert(type: String, extra: Map<String, Any> = emptyMap()) {
    val body = JSONObject().put("type", type)
    extra.forEach { (k, v) -> body.put(k, v) }
    session.request("POST", "/device/alerts", body)
  }

  private fun appVersion(): String = runCatching {
    context.packageManager.getPackageInfo(context.packageName, 0).versionName
  }.getOrNull() ?: "0.0.0"

  private fun batteryLevel(): Int? {
    val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return null
    return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
  }

  companion object {
    private const val TAG = "SafeKid"

    /** Wall time of the last accepted heartbeat in this process (0 = none yet). */
    @Volatile var lastHeartbeatOkAt = 0L
  }
}
