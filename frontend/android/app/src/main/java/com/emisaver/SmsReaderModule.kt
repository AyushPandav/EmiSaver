package com.emisaver

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsReaderModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SmsReader"
    }

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = reactContext.checkSelfPermission(
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun getMessages(promise: Promise) {
        readMessagesInternal(null, null, promise)
    }

    @ReactMethod
    fun readInbox(lookbackDays: Double, maxCount: Double, promise: Promise) {
        readMessagesInternal(lookbackDays.toLong(), maxCount.toInt(), promise)
    }

    private fun readMessagesInternal(lookbackDays: Long?, maxCount: Int?, promise: Promise) {
        if (
            reactContext.checkSelfPermission(
                Manifest.permission.READ_SMS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            promise.reject(
                "PERMISSION_DENIED",
                "READ_SMS permission has not been granted"
            )
            return
        }

        try {
            val messages = Arguments.createArray()

            var selection: String? = null
            var selectionArgs: Array<String>? = null

            if (lookbackDays != null && lookbackDays > 0) {
                val cutoffTime = System.currentTimeMillis() - (lookbackDays * 24L * 60L * 60L * 1000L)
                selection = "${Telephony.Sms.DATE} >= ?"
                selectionArgs = arrayOf(cutoffTime.toString())
            }

            val cursor = reactContext.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.TYPE
                ),
                selection,
                selectionArgs,
                "${Telephony.Sms.DATE} DESC"
            )

            cursor?.use {
                val idIndex = it.getColumnIndex(Telephony.Sms._ID)
                val addressIndex = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIndex = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIndex = it.getColumnIndex(Telephony.Sms.DATE)
                val typeIndex = it.getColumnIndex(Telephony.Sms.TYPE)

                var count = 0
                val limit = if (maxCount != null && maxCount > 0) maxCount else Int.MAX_VALUE

                while (it.moveToNext() && count < limit) {
                    val message = Arguments.createMap()

                    message.putString(
                        "id",
                        if (idIndex >= 0) (it.getString(idIndex) ?: "") else ""
                    )

                    message.putString(
                        "sender",
                        if (addressIndex >= 0) (it.getString(addressIndex) ?: "") else ""
                    )

                    message.putString(
                        "body",
                        if (bodyIndex >= 0) (it.getString(bodyIndex) ?: "") else ""
                    )

                    val timestamp = if (dateIndex >= 0) it.getLong(dateIndex) else 0L
                    message.putDouble(
                        "timestamp",
                        timestamp.toDouble()
                    )

                    message.putInt(
                        "type",
                        if (typeIndex >= 0) it.getInt(typeIndex) else 1
                    )

                    // Also provide ISO date string for backwards compatibility with JS bridge
                    val isoDate = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }.format(java.util.Date(timestamp))
                    message.putString("date", isoDate)
                    message.putString("address", if (addressIndex >= 0) (it.getString(addressIndex) ?: "") else "")

                    messages.pushMap(message)
                    count++
                }
            }

            promise.resolve(messages)

        } catch (e: Exception) {
            promise.reject(
                "SMS_READ_ERROR",
                e.message,
                e
            )
        }
    }
}
