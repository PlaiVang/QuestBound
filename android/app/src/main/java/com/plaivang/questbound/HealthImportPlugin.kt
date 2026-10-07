package com.plaivang.questbound

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

@CapacitorPlugin(name = "HealthImport")
class HealthImportPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class)
    )
    private val samsung = "com.sec.android.app.shealth"

    @PluginMethod
    fun importRuns(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("Health Connect is unavailable. Install or update Health Connect and try again.")
            return
        }
        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, permissions)
                    startActivityForResult(call, intent, "permissionResult")
                } else readRuns(call)
            } catch (e: Exception) {
                call.reject("Unable to access Health Connect: ${e.message}", e)
            }
        }
    }

    @ActivityCallback
    private fun permissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("Exercise, distance and heart-rate read permissions are required for this import.")
                } else readRuns(call)
            } catch (e: Exception) {
                call.reject("Health Connect permission check failed: ${e.message}", e)
            }
        }
    }

    private suspend fun readRuns(call: PluginCall) {
        val client = HealthConnectClient.getOrCreate(context)
        val now = Instant.now()
        val range = TimeRangeFilter.between(now.minus(Duration.ofDays(30)), now)
        val output = JSArray()
        var page: String? = null
        do {
            val response = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, range, pageToken = page))
            for (session in response.records) {
                if (session.metadata.dataOrigin.packageName != samsung ||
                    session.endTime > now ||
                    session.exerciseType !in setOf(ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL)) continue
                val filter = TimeRangeFilter.between(session.startTime, session.endTime)
                var distance = 0.0
                var distancePage: String? = null
                do {
                    val records = client.readRecords(ReadRecordsRequest(DistanceRecord::class, filter, pageToken = distancePage))
                    distance += records.records.filter {
                        it.metadata.dataOrigin.packageName == samsung && it.startTime >= session.startTime && it.endTime <= session.endTime
                    }.sumOf { it.distance.inMeters }
                    distancePage = records.pageToken
                } while (distancePage != null)
                val heart = mutableListOf<Long>()
                var heartPage: String? = null
                do {
                    val records = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter, pageToken = heartPage))
                    records.records.filter { it.metadata.dataOrigin.packageName == samsung }.forEach { record ->
                        heart += record.samples.filter {
                            it.time >= session.startTime && it.time < session.endTime && it.beatsPerMinute in 30..250
                        }.map { it.beatsPerMinute }
                    }
                    heartPage = records.pageToken
                } while (heartPage != null)
                val run = JSObject()
                run.put("id", session.metadata.id)
                run.put("startedAt", session.startTime.toEpochMilli())
                run.put("durationSec", Duration.between(session.startTime, session.endTime).seconds)
                run.put("distanceM", distance)
                if (heart.isNotEmpty()) {
                    run.put("averageBpm", kotlin.math.round(heart.average()).toInt())
                    run.put("maxBpm", heart.max().toInt())
                }
                output.put(run)
            }
            page = response.pageToken
        } while (page != null)
        val result = JSObject()
        result.put("runs", output)
        call.resolve(result)
    }

    override fun handleOnDestroy() { scope.cancel() }
}
