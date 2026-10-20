package uz.safekid.devicecontrol

/**
 * Recognises system screens that would remove SafeKid's protection, using only
 * the window's package and class name (never its content).
 *
 * Class names differ between Android builds and OEMs, so matching is by
 * well-known fragments; window class names are logged under the "SafeKidWin"
 * tag to extend the list per OEM.
 */
object TamperGuard {
  enum class Target(val wire: String) {
    UNINSTALL("uninstall"),
    DEVICE_ADMIN("device_admin"),
    ACCESSIBILITY_SETTINGS("accessibility_settings"),
    APP_SETTINGS("app_settings"),
  }

  data class State(
    /** Device admin is active, so its screen can only be used to deactivate it. */
    val adminActive: Boolean,
    /** SafeKid's setup wizard just opened system settings: allow app/accessibility pages briefly. */
    val appSettingsGrace: Boolean,
  )

  /** Set when SafeKid's own setup flow opens system settings for the user. */
  @Volatile var appSettingsGraceUntil = 0L

  fun grantSetupGrace(seconds: Long = 90) {
    appSettingsGraceUntil = System.currentTimeMillis() + seconds * 1000
  }

  private val SETTINGS_HINTS = listOf("settings", "permissionmanager", "securitycenter", "iqoo.secure", "safecenter")

  fun classify(pkg: String, className: String?, state: State): Target? {
    val cls = className?.lowercase() ?: return null
    val p = pkg.lowercase()
    val settingsLike = SETTINGS_HINTS.any { p.contains(it) }

    if (cls.contains("uninstall")) return Target.UNINSTALL
    if (cls.contains("deviceadmin")) return if (state.adminActive) Target.DEVICE_ADMIN else null
    if (settingsLike && cls.contains("accessibility")) {
      return if (state.appSettingsGrace) null else Target.ACCESSIBILITY_SETTINGS
    }
    if (settingsLike && APP_DETAILS.any { cls.contains(it) }) {
      return if (state.appSettingsGrace) null else Target.APP_SETTINGS
    }
    return null
  }

  private val APP_DETAILS = listOf("installedappdetails", "appinfodashboard", "appdetails", "applicationdetails", "appinfo")
}
