package uz.safekid.devicecontrol

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import android.view.accessibility.AccessibilityEvent
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Enforces the stored policy offline: watches which app comes to the foreground
 * (window state changes only, no screen content) and covers blocked apps or a
 * locked device with [BlockOverlay].
 */
class EnforcementAccessibilityService : AccessibilityService() {
  private lateinit var overlay: BlockOverlay
  private lateinit var store: DeviceStore
  private lateinit var evaluator: PolicyEvaluator
  private val handler = Handler(Looper.getMainLooper())
  private var policy: Policy? = null
  private var foregroundPackage: String? = null
  private var syncFallback: ScheduledExecutorService? = null

  private val policyListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
    if (key == DeviceStore.KEY_POLICY || key == null) handler.post { reloadPolicy() }
  }

  /** Re-checks periodically so timed locks and schedules start/end without app switches. */
  private val tick = object : Runnable {
    override fun run() {
      enforce()
      heartbeatIfStale()
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    overlay = BlockOverlay(this)
    store = DeviceSession.get(this).store
    evaluator = PolicyEvaluator(InstalledApps.essential(this), InstalledApps.launchers(this), ::isLaunchable)
    store.registerListener(policyListener)
    reloadPolicy()
    handler.post(tick)
    EnforcementService.start(this)
    startSyncFallback()
  }

  /**
   * Some OEMs (Vivo, Xiaomi, …) kill foreground services aggressively. The bound
   * accessibility service lives on, so it restarts the service and, if that is
   * not allowed, keeps heartbeats and policy sync going itself.
   */
  private fun startSyncFallback() {
    val sync = SyncEngine(this)
    syncFallback = Executors.newSingleThreadScheduledExecutor().apply {
      scheduleWithFixedDelay({
        if (EnforcementService.isRunning || !DeviceSession.get(this@EnforcementAccessibilityService).isLinked) return@scheduleWithFixedDelay
        if (!EnforcementService.start(this@EnforcementAccessibilityService)) {
          runCatching { sync.heartbeat() }
        }
      }, EnforcementService.SYNC_POLL_SECONDS, EnforcementService.SYNC_POLL_SECONDS, TimeUnit.SECONDS)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    val cls = event.className?.toString()
    // Package/class names only (no window content), to tune OEM-specific screens via logcat.
    Log.i(WINDOW_TAG, "$pkg/$cls")
    // Our own windows (including the overlay) never change the decision.
    if (pkg == packageName) return
    if (DeviceSession.get(this).isLinked) {
      val state = TamperGuard.State(
        adminActive = Permissions.isDeviceAdminActive(this),
        appSettingsGrace = System.currentTimeMillis() < TamperGuard.appSettingsGraceUntil,
      )
      TamperGuard.classify(pkg, cls, state)?.let {
        onTamper(it)
        return
      }
    }
    // Dialogs, panels and OEM overlays are not "opening an app": keep the current app.
    if (!isActivity(pkg, cls) && !isLaunchable(pkg)) return
    foregroundPackage = pkg
    enforce()
  }

  private val lastTamperReport = HashMap<TamperGuard.Target, Long>()

  /** Leaves the protected screen and tells the parent (at most every 2 minutes per screen). */
  private fun onTamper(target: TamperGuard.Target) {
    performGlobalAction(GLOBAL_ACTION_BACK)
    performGlobalAction(GLOBAL_ACTION_HOME)
    Toast.makeText(this, R.string.safekid_protected_screen, Toast.LENGTH_LONG).show()
    val now = System.currentTimeMillis()
    if (now - (lastTamperReport[target] ?: 0L) < 2 * 60_000) return
    lastTamperReport[target] = now
    background.execute {
      runCatching { SyncEngine(this).reportAlert("TAMPER_ATTEMPT", mapOf("target" to target.wire)) }
        .onFailure { Log.w(TAG, "Tamper report failed: ${it.javaClass.simpleName}: ${it.message}") }
    }
  }

  /** Runs a heartbeat if none succeeded recently (OEMs sometimes stall the service's timer). */
  private fun heartbeatIfStale() {
    if (!DeviceSession.get(this).isLinked) return
    if (System.currentTimeMillis() - SyncEngine.lastHeartbeatOkAt < 2 * 60_000) return
    if (heartbeatInFlight) return
    heartbeatInFlight = true
    background.execute {
      try {
        SyncEngine(this).heartbeat()
      } catch (e: Exception) {
        Log.w(TAG, "Fallback heartbeat failed: ${e.javaClass.simpleName}: ${e.message}")
      } finally {
        heartbeatInFlight = false
      }
    }
  }

  @Volatile private var heartbeatInFlight = false
  private val background = Executors.newSingleThreadExecutor()

  private val launchableCache = HashMap<String, Boolean>()

  /** Has a home-screen icon, i.e. is an app the parent can allow or block. */
  private fun isLaunchable(pkg: String): Boolean =
    launchableCache.getOrPut(pkg) { packageManager.getLaunchIntentForPackage(pkg) != null }

  private fun isActivity(pkg: String, className: String?): Boolean {
    if (className.isNullOrEmpty()) return false
    return try {
      packageManager.getActivityInfo(ComponentName(pkg, className), 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }
  }

  override fun onInterrupt() = Unit

  override fun onDestroy() {
    syncFallback?.shutdownNow()
    background.shutdownNow()
    handler.removeCallbacksAndMessages(null)
    if (::store.isInitialized) store.unregisterListener(policyListener)
    if (::overlay.isInitialized) overlay.hide()
    super.onDestroy()
  }

  private fun reloadPolicy() {
    policy = store.policy()
    enforce()
  }

  private fun enforce() {
    if (!::overlay.isInitialized) return
    val current = policy
    val now = Instant.now()
    // A locked device is covered no matter which app is in front.
    val lockReason = current?.let { evaluator.lockReason(it, now) }
    val decision = foregroundPackage?.let { evaluator.evaluate(current, it, now) }
      ?: lockReason?.let { Decision.Block(it) }
      ?: Decision.Allow
    when (decision) {
      is Decision.Block -> overlay.show(decision.reason)
      Decision.Allow -> overlay.hide()
    }
  }

  companion object {
    private const val TICK_MS = 15_000L
    private const val TAG = "SafeKid"
    private const val WINDOW_TAG = "SafeKidWin"
  }
}
