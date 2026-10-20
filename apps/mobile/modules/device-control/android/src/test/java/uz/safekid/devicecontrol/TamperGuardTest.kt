package uz.safekid.devicecontrol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TamperGuardTest {
  private val active = TamperGuard.State(adminActive = true, appSettingsGrace = false)
  private val setup = TamperGuard.State(adminActive = false, appSettingsGrace = true)

  @Test fun blocksUninstallDialogsEverywhere() {
    assertEquals(
      TamperGuard.Target.UNINSTALL,
      TamperGuard.classify("com.google.android.packageinstaller", "com.android.packageinstaller.UninstallerActivity", setup),
    )
    assertEquals(
      TamperGuard.Target.UNINSTALL,
      TamperGuard.classify("com.bbk.launcher2", "com.bbk.launcher2.UninstallDialog", active),
    )
  }

  @Test fun deviceAdminScreenOnlyWhenAdminIsActive() {
    val cls = "com.android.settings.DeviceAdminAdd"
    assertEquals(TamperGuard.Target.DEVICE_ADMIN, TamperGuard.classify("com.android.settings", cls, active))
    assertNull(TamperGuard.classify("com.android.settings", cls, setup))
  }

  @Test fun accessibilitySettingsInSettingsApps() {
    assertEquals(
      TamperGuard.Target.ACCESSIBILITY_SETTINGS,
      TamperGuard.classify("com.android.settings", "com.android.settings.Settings\$AccessibilitySettingsActivity", active),
    )
    assertNull(TamperGuard.classify("com.example.game", "com.example.game.AccessibilityHelpActivity", active))
    assertNull(TamperGuard.classify("com.android.settings", "com.android.settings.Settings\$AccessibilitySettingsActivity", setup))
  }

  @Test fun appSettingsAllowedDuringWizardGrace() {
    val cls = "com.android.settings.applications.InstalledAppDetails"
    assertEquals(TamperGuard.Target.APP_SETTINGS, TamperGuard.classify("com.android.settings", cls, active))
    assertNull(TamperGuard.classify("com.android.settings", cls, setup))
  }

  @Test fun ordinaryScreensPass() {
    assertNull(TamperGuard.classify("org.telegram.messenger", "org.telegram.ui.LaunchActivity", active))
    assertNull(TamperGuard.classify("com.android.settings", "com.android.settings.wifi.WifiSettings", active))
    assertNull(TamperGuard.classify("com.android.settings", null, active))
  }
}
