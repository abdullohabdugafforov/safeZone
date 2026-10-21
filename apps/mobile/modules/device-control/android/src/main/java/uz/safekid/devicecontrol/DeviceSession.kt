package uz.safekid.devicecontrol

import android.content.Context
import android.util.Base64
import android.util.Log
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiResponse(val code: Int, val body: JSONObject?)

/** Thrown when the server no longer accepts this device (unlinked or tokens revoked). */
class DeviceUnlinkedException : Exception("Device is no longer linked")

/**
 * Single owner of the device credentials. All HTTP calls from native code go
 * through here so the refresh token is rotated by exactly one party.
 */
class DeviceSession private constructor(context: Context) {
  private val appContext = context.applicationContext
  val store = DeviceStore(appContext)
  private val lock = Any()

  val isLinked: Boolean get() = store.credentials() != null

  /** Valid access token, refreshing when it expires within a minute. */
  fun accessToken(): String? = synchronized(lock) {
    val creds = store.credentials() ?: return null
    if (secondsUntilExpiry(creds.accessToken) > 60) return creds.accessToken
    refreshLocked(creds)
  }

  /** Authenticated request; retries once after a refresh on 401. */
  @Throws(IOException::class, DeviceUnlinkedException::class)
  fun request(method: String, path: String, body: JSONObject? = null): ApiResponse {
    val creds = store.credentials() ?: throw DeviceUnlinkedException()
    val token = accessToken() ?: throw DeviceUnlinkedException()
    val first = http(creds.apiUrl, method, path, body, token)
    if (first.code != 401) return first
    val fresh = synchronized(lock) { store.credentials()?.let { refreshLocked(it) } } ?: throw DeviceUnlinkedException()
    val second = http(creds.apiUrl, method, path, body, fresh)
    if (second.code == 401) {
      onUnlinked()
      throw DeviceUnlinkedException()
    }
    return second
  }

  private fun refreshLocked(creds: Credentials): String? {
    val res = http(creds.apiUrl, "POST", "/auth/refresh", JSONObject().put("refreshToken", creds.refreshToken), null)
    return when {
      res.code == 200 && res.body != null -> {
        val access = res.body.getString("accessToken")
        store.updateTokens(access, res.body.getString("refreshToken"))
        access
      }
      res.code == 401 -> {
        onUnlinked()
        null
      }
      else -> throw IOException("Token refresh failed with HTTP ${res.code}")
    }
  }

  private fun onUnlinked() {
    Log.w(TAG, "Server rejected device credentials; stopping enforcement")
    store.clear()
    EnforcementService.stop(appContext)
    // Unlinked by the parent: let the phone be used (and SafeKid be removed) normally.
    Permissions.removeOwnDeviceAdmin(appContext)
    DeviceEvents.emitUnlinked()
  }

  companion object {
    private const val TAG = "SafeKid"

    @Volatile private var instance: DeviceSession? = null

    fun get(context: Context): DeviceSession =
      instance ?: synchronized(this) { instance ?: DeviceSession(context).also { instance = it } }

    fun http(baseUrl: String, method: String, path: String, body: JSONObject?, token: String?): ApiResponse {
      val conn = URL("$baseUrl/v1$path").openConnection() as HttpURLConnection
      try {
        conn.requestMethod = method
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        conn.setRequestProperty("Accept", "application/json")
        token?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) {
          conn.doOutput = true
          conn.setRequestProperty("Content-Type", "application/json")
          conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = if (text.isNotBlank() && text.trimStart().startsWith("{")) runCatching { JSONObject(text) }.getOrNull() else null
        return ApiResponse(code, json)
      } finally {
        conn.disconnect()
      }
    }

    /** Reads `exp` from a JWT without verifying it (the server does that). */
    fun secondsUntilExpiry(jwt: String): Long = runCatching {
      val payload = jwt.split(".")[1]
      val json = JSONObject(String(Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)))
      json.getLong("exp") - System.currentTimeMillis() / 1000
    }.getOrDefault(0)
  }
}
