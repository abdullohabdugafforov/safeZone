package uz.safekid.devicecontrol

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant

class PolicyEvaluatorTest {
  private val evaluator = PolicyEvaluator(
    essential = setOf("uz.safekid.app", "com.android.systemui", "com.google.android.dialer"),
    launchers = setOf("com.google.android.apps.nexuslauncher"),
  )

  // Wednesday 2026-10-14 12:00 in Tashkent (UTC+5)
  private val noon = Instant.parse("2026-10-14T07:00:00Z")

  private fun policy(
    mode: String = "unrestricted",
    allowed: List<String> = emptyList(),
    alwaysAllowed: List<String> = emptyList(),
    lock: String = """{"state":"unlocked"}""",
    schedules: String = "[]",
    tempUnlock: String? = null,
  ): Policy = Policy.fromJson(
    JSONObject(
      """
      {"version": 3, "document": {
        "schemaVersion": 1, "mode": "$mode",
        "allowedApps": ${allowed.joinToString(",", "[", "]") { "\"$it\"" }},
        "alwaysAllowedApps": ${alwaysAllowed.joinToString(",", "[", "]") { "\"$it\"" }},
        "lock": $lock, "schedules": $schedules, "appLimits": [],
        ${tempUnlock?.let { "\"tempUnlock\": {\"until\": \"$it\"}," } ?: ""}
        "timezone": "Asia/Tashkent"
      }}
      """.trimIndent(),
    ),
  )

  private fun decide(p: Policy?, pkg: String, now: Instant = noon) = evaluator.evaluate(p, pkg, now)

  private val block = { reason: Decision.Reason -> Decision.Block(reason) }

  @Test fun noPolicyAllowsEverything() {
    assertEquals(Decision.Allow, decide(null, "com.game"))
  }

  @Test fun unrestrictedAllowsApps() {
    assertEquals(Decision.Allow, decide(policy(), "com.game"))
  }

  @Test fun allowlistBlocksUnlistedApps() {
    val p = policy(mode = "allowlist", allowed = listOf("com.duolingo"))
    assertEquals(Decision.Allow, decide(p, "com.duolingo"))
    assertEquals(block(Decision.Reason.NOT_ALLOWED), decide(p, "com.game"))
    assertEquals(block(Decision.Reason.NOT_ALLOWED), decide(p, "com.android.settings"))
  }

  @Test fun allowlistKeepsLauncherEssentialAndAlwaysAllowed() {
    val p = policy(mode = "allowlist", alwaysAllowed = listOf("com.whatsapp"))
    assertEquals(Decision.Allow, decide(p, "com.google.android.apps.nexuslauncher"))
    assertEquals(Decision.Allow, decide(p, "uz.safekid.app"))
    assertEquals(Decision.Allow, decide(p, "com.google.android.dialer"))
    assertEquals(Decision.Allow, decide(p, "com.whatsapp"))
  }

  @Test fun indefiniteLockBlocksEvenLauncherButNotEssentials() {
    val p = policy(lock = """{"state":"locked"}""")
    assertEquals(block(Decision.Reason.LOCKED), decide(p, "com.duolingo"))
    assertEquals(block(Decision.Reason.LOCKED), decide(p, "com.google.android.apps.nexuslauncher"))
    assertEquals(Decision.Allow, decide(p, "com.google.android.dialer"))
  }

  @Test fun timedLockExpiresOffline() {
    val p = policy(lock = """{"state":"locked","until":"2026-10-14T12:30:00+05:00"}""")
    assertEquals(block(Decision.Reason.LOCKED), decide(p, "com.game", noon))
    assertEquals(Decision.Allow, decide(p, "com.game", Instant.parse("2026-10-14T07:31:00Z")))
  }

  @Test fun scheduleCrossingMidnight() {
    val p = policy(schedules = """[{"id":"night","days":["wed"],"start":"22:00","end":"07:00","action":"lock"}]""")
    val wed2230 = Instant.parse("2026-10-14T17:30:00Z")
    val thu0630 = Instant.parse("2026-10-15T01:30:00Z")
    val thu0730 = Instant.parse("2026-10-15T02:30:00Z")
    val tue2230 = Instant.parse("2026-10-13T17:30:00Z")
    assertEquals(Decision.Allow, decide(p, "com.game", noon))
    assertEquals(block(Decision.Reason.SCHEDULE), decide(p, "com.game", wed2230))
    assertEquals(block(Decision.Reason.SCHEDULE), decide(p, "com.game", thu0630))
    assertEquals(Decision.Allow, decide(p, "com.game", thu0730))
    assertEquals(Decision.Allow, decide(p, "com.game", tue2230))
  }

  @Test fun sameDaySchedule() {
    val p = policy(schedules = """[{"id":"school","days":["wed"],"start":"08:00","end":"13:00","action":"lock"}]""")
    assertEquals(block(Decision.Reason.SCHEDULE), decide(p, "com.game", noon))
    assertEquals(Decision.Allow, decide(p, "com.game", Instant.parse("2026-10-14T08:00:00Z")))
  }

  @Test fun temporaryUnlockOverridesLock() {
    val p = policy(lock = """{"state":"locked"}""", tempUnlock = "2026-10-14T12:30:00+05:00")
    assertEquals(Decision.Allow, decide(p, "com.game", noon))
    assertEquals(block(Decision.Reason.LOCKED), decide(p, "com.game", Instant.parse("2026-10-14T08:00:00Z")))
  }

  @Test fun temporaryUnlockDoesNotBypassAllowlist() {
    val p = policy(mode = "allowlist", tempUnlock = "2026-10-14T12:30:00+05:00")
    assertEquals(block(Decision.Reason.NOT_ALLOWED), decide(p, "com.game", noon))
  }

  @Test fun parsesVersionAndRejectsMalformed() {
    assertEquals(3, policy().version)
    assertThrows(Exception::class.java) { Policy.fromJson(JSONObject("""{"version": 1}""")) }
  }

  @Test fun allowlistIgnoresNonLaunchableSystemWindows() {
    val launchable = setOf("org.telegram.messenger", "com.game")
    val oem = PolicyEvaluator(
      essential = setOf("uz.safekid.app"),
      launchers = setOf("com.bbk.launcher2"),
      isLaunchableApp = { it in launchable },
    )
    val p = policy(mode = "allowlist", allowed = listOf("org.telegram.messenger"))
    assertEquals(Decision.Allow, oem.evaluate(p, "com.bbk.launcher2", noon))
    assertEquals(Decision.Allow, oem.evaluate(p, "org.telegram.messenger", noon))
    assertEquals(Decision.Allow, oem.evaluate(p, "com.vivo.upslide", noon))
    assertEquals(block(Decision.Reason.NOT_ALLOWED), oem.evaluate(p, "com.game", noon))
  }

  @Test fun lockStillCoversNonLaunchableWindows() {
    val oem = PolicyEvaluator(emptySet(), emptySet(), isLaunchableApp = { false })
    val p = policy(lock = """{"state":"locked"}""")
    assertEquals(block(Decision.Reason.LOCKED), oem.evaluate(p, "com.vivo.upslide", noon))
  }
}
