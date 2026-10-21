package uz.safekid.devicecontrol

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat

/** Permission kinds match `permissionKindSchema` in packages/shared. */
object Permissions {
  const val ACCESSIBILITY = "accessibility"
  const val USAGE_ACCESS = "usageAccess"
  const val DEVICE_ADMIN = "deviceAdmin"
  const val NOTIFICATIONS = "notifications"
  const val BATTERY = "batteryOptimization"
  const val FAMILY_CONTROLS = "familyControls"

  /** Asked by the setup wizard, in this order. */
  val REQUIRED = listOf(NOTIFICATIONS, ACCESSIBILITY, DEVICE_ADMIN, BATTERY)

  fun status(context: Context): Map<String, String> = mapOf(
    ACCESSIBILITY to state(isAccessibilityEnabled(context)),
    USAGE_ACCESS to state(hasUsageAccess(context)),
    DEVICE_ADMIN to state(isDeviceAdminActive(context)),
    NOTIFICATIONS to state(NotificationManagerCompat.from(context).areNotificationsEnabled()),
    BATTERY to state(isIgnoringBatteryOptimizations(context)),
    FAMILY_CONTROLS to "unavailable",
  )

  private fun state(granted: Boolean) = if (granted) "granted" else "denied"

  fun isAccessibilityEnabled(context: Context): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
    val component = ComponentName(context, EnforcementAccessibilityService::class.java)
    return enabled.split(':').any {
      it.equals(component.flattenToString(), ignoreCase = true) ||
        it.equals(component.flattenToShortString(), ignoreCase = true)
    }
  }

  fun isDeviceAdminActive(context: Context): Boolean {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    return dpm.isAdminActive(adminComponent(context))
  }

  fun adminComponent(context: Context) = ComponentName(context, SafeKidDeviceAdminReceiver::class.java)

  /** An app may always drop its own admin rights; done when the parent unlinks the device. */
  fun removeOwnDeviceAdmin(context: Context) {
    val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val admin = adminComponent(context)
    if (dpm.isAdminActive(admin)) runCatching { dpm.removeActiveAdmin(admin) }
  }

  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  /** System screen where the user can grant [kind] themselves. */
  fun settingsIntent(context: Context, kind: String): Intent? = when (kind) {
    ACCESSIBILITY -> Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    USAGE_ACCESS -> Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    DEVICE_ADMIN -> Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
      .putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent(context))
      .putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, context.getString(R.string.safekid_device_admin_explanation))
    NOTIFICATIONS -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    // The settings list (not the direct exemption dialog), which needs no restricted permission.
    BATTERY -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
    else -> null
  }?.also {
    if (kind == NOTIFICATIONS && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      it.action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
      it.data = Uri.parse("package:${context.packageName}")
    }
  }
}
