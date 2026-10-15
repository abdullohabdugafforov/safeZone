package uz.safekid.devicecontrol

import android.accessibilityservice.AccessibilityService
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import java.time.Instant

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

  private val policyListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
    if (key == DeviceStore.KEY_POLICY || key == null) handler.post { reloadPolicy() }
  }

  /** Re-checks periodically so timed locks and schedules start/end without app switches. */
  private val tick = object : Runnable {
    override fun run() {
      enforce()
      handler.postDelayed(this, TICK_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    overlay = BlockOverlay(this)
    store = DeviceSession.get(this).store
    evaluator = PolicyEvaluator(InstalledApps.essential(this), InstalledApps.launchers(this))
    store.registerListener(policyListener)
    reloadPolicy()
    handler.post(tick)
    EnforcementService.start(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    // Our own windows (including the overlay) never change the decision.
    if (pkg == packageName) return
    foregroundPackage = pkg
    enforce()
  }

  override fun onInterrupt() = Unit

  override fun onDestroy() {
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
  }
}
