package uz.safekid.devicecontrol

import android.app.admin.DeviceAdminReceiver
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.concurrent.Executors

private val background = Executors.newSingleThreadExecutor()

private fun reportAsync(context: Context, type: String) {
  val app = context.applicationContext
  background.execute { runCatching { SyncEngine(app).reportAlert(type) } }
}

/** Active device admin = SafeKid cannot be uninstalled until it is turned off (parent is alerted). */
class SafeKidDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
    reportAsync(context, "DEVICE_ADMIN_DISABLE_REQUESTED")
    return context.getString(R.string.safekid_device_admin_disable_warning)
  }

  override fun onDisabled(context: Context, intent: Intent) {
    reportAsync(context, "DEVICE_ADMIN_DISABLED")
  }
}

/** Restarts protection after reboot or app update. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      EnforcementService.start(context)
    }
  }
}
