package uz.safekid.devicecontrol

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.view.inputmethod.InputMethodManager
import android.telecom.TelecomManager

data class AppInfo(val appId: String, val label: String, val isSystem: Boolean)

object InstalledApps {
  /**
   * Launchable apps (what a child can open). Uses a `<queries>` launcher intent
   * instead of the restricted QUERY_ALL_PACKAGES permission.
   */
  fun list(context: Context): List<AppInfo> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    return pm.queryIntentActivities(intent, 0)
      .map { it.activityInfo.applicationInfo }
      .distinctBy { it.packageName }
      .filter { it.packageName != context.packageName }
      .map {
        AppInfo(
          appId = it.packageName,
          label = pm.getApplicationLabel(it).toString().take(200).ifBlank { it.packageName },
          isSystem = it.flags and ApplicationInfo.FLAG_SYSTEM != 0,
        )
      }
      .sortedBy { it.label.lowercase() }
  }

  fun launchers(context: Context): Set<String> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    return context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
      .map { it.activityInfo.packageName }
      .toSet()
  }

  /** Packages that must always work: SafeKid, system UI, phone/emergency and keyboards. */
  fun essential(context: Context): Set<String> {
    val set = mutableSetOf(
      context.packageName,
      "android",
      "com.android.systemui",
      "com.android.phone",
      "com.android.server.telecom",
      "com.android.emergency",
      "com.google.android.dialer",
    )
    (context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager)?.defaultDialerPackage?.let(set::add)
    (context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)
      ?.enabledInputMethodList?.forEach { set.add(it.packageName) }
    return set
  }
}
