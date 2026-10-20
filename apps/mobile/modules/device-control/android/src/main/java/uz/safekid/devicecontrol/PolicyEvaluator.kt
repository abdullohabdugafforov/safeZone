package uz.safekid.devicecontrol

import java.time.Instant

sealed class Decision {
  object Allow : Decision()
  data class Block(val reason: Reason) : Decision()

  enum class Reason { LOCKED, SCHEDULE, NOT_ALLOWED }
}

/**
 * Pure decision logic: may [packageName] be in the foreground right now?
 *
 * @param essential packages that always work (SafeKid, system UI, phone/emergency, keyboards)
 * @param launchers home screens: allowed unless the device is locked
 * @param isLaunchableApp whether a package is an app the child can open from the home
 *   screen. The allowlist only governs those (it is chosen from that list); OEM system
 *   windows and services without a launcher icon are never blocked by it.
 */
class PolicyEvaluator(
  private val essential: Set<String>,
  private val launchers: Set<String>,
  private val isLaunchableApp: (String) -> Boolean = { true },
) {
  fun evaluate(policy: Policy?, packageName: String, now: Instant): Decision {
    if (policy == null) return Decision.Allow
    if (packageName in essential || packageName in policy.alwaysAllowedApps) return Decision.Allow
    lockReason(policy, now)?.let { return Decision.Block(it) }
    if (policy.mode == Policy.Mode.ALLOWLIST &&
      packageName !in policy.allowedApps &&
      packageName !in launchers &&
      isLaunchableApp(packageName)
    ) {
      return Decision.Block(Decision.Reason.NOT_ALLOWED)
    }
    return Decision.Allow
  }

  /** Why the whole device is locked right now, or null. A temporary unlock wins over locks. */
  fun lockReason(policy: Policy, now: Instant): Decision.Reason? {
    if (policy.tempUnlockUntil?.isAfter(now) == true) return null
    val lock = policy.lock
    if (lock.locked && (lock.until == null || now.isBefore(lock.until))) return Decision.Reason.LOCKED
    val local = now.atZone(policy.zone)
    if (policy.schedules.any { it.isActive(local) }) return Decision.Reason.SCHEDULE
    return null
  }
}
