package uz.safekid.devicecontrol

import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

/** On-device copy of the server policy (see packages/shared policyDocumentSchema). */
data class Policy(
  val version: Int,
  val mode: Mode,
  val allowedApps: Set<String>,
  val alwaysAllowedApps: Set<String>,
  val lock: Lock,
  val schedules: List<Schedule>,
  val tempUnlockUntil: Instant?,
  val zone: ZoneId,
) {
  enum class Mode { UNRESTRICTED, ALLOWLIST }

  data class Lock(val locked: Boolean, val until: Instant?)

  /** Lock window; [end] before [start] means it crosses midnight into the next day. */
  data class Schedule(val days: Set<DayOfWeek>, val start: LocalTime, val end: LocalTime) {
    fun isActive(at: ZonedDateTime): Boolean {
      val time = at.toLocalTime()
      val day = at.dayOfWeek
      return if (start < end) {
        day in days && time >= start && time < end
      } else {
        (day in days && time >= start) || (day.minus(1) in days && time < end)
      }
    }
  }

  companion object {
    private val WEEKDAYS = mapOf(
      "mon" to DayOfWeek.MONDAY, "tue" to DayOfWeek.TUESDAY, "wed" to DayOfWeek.WEDNESDAY,
      "thu" to DayOfWeek.THURSDAY, "fri" to DayOfWeek.FRIDAY, "sat" to DayOfWeek.SATURDAY,
      "sun" to DayOfWeek.SUNDAY,
    )

    /** Parses `{ version, document }`. Throws on malformed input so the previous policy is kept. */
    fun fromJson(json: JSONObject): Policy {
      val doc = json.getJSONObject("document")
      val lock = doc.getJSONObject("lock")
      return Policy(
        version = json.getInt("version"),
        mode = if (doc.getString("mode") == "allowlist") Mode.ALLOWLIST else Mode.UNRESTRICTED,
        allowedApps = doc.getJSONArray("allowedApps").strings().toSet(),
        alwaysAllowedApps = doc.getJSONArray("alwaysAllowedApps").strings().toSet(),
        lock = Lock(
          locked = lock.getString("state") == "locked",
          until = lock.optStringOrNull("until")?.let(::parseInstant),
        ),
        schedules = doc.optJSONArray("schedules")?.objects()?.map { s ->
          Schedule(
            days = s.getJSONArray("days").strings().mapNotNull { WEEKDAYS[it] }.toSet(),
            start = LocalTime.parse(s.getString("start")),
            end = LocalTime.parse(s.getString("end")),
          )
        } ?: emptyList(),
        tempUnlockUntil = doc.optJSONObject("tempUnlock")?.optStringOrNull("until")?.let(::parseInstant),
        zone = ZoneId.of(doc.getString("timezone")),
      )
    }

    fun parseInstant(iso: String): Instant = OffsetDateTime.parse(iso).toInstant()
  }
}

private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }

private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

private fun JSONObject.optStringOrNull(key: String): String? =
  if (has(key) && !isNull(key)) getString(key) else null
