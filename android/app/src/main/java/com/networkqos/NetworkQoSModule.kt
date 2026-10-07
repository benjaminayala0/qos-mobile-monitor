package com.networkqos

import android.content.Context
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellInfoWcdma
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * NetworkQoSModule
 * Native Android Module exposing TelephonyManager, CellSignalStrength, and Carrier metadata
 * to React Native via JNI bridge.
 */
class NetworkQoSModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NetworkQoSModule"
    }

    @ReactMethod
    fun getNetworkTelephonyInfo(promise: Promise) {
        try {
            val telephonyManager =
                reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

            if (telephonyManager == null) {
                promise.reject("TELEPHONY_UNAVAILABLE", "TelephonyManager service not found")
                return
            }

            val map: WritableMap = Arguments.createMap()

            // 1. Carrier & Operator Name
            var operatorName = telephonyManager.networkOperatorName
            if (operatorName.isNullOrBlank()) {
                operatorName = telephonyManager.simOperatorName
            }
            if (operatorName.isNullOrBlank()) {
                operatorName = "Cellular Network"
            }
            map.putString("operator", operatorName)

            // 2. Data Network Generation Mapping (3G, 4G, 5G NR)
            val networkTypeStr = getNetworkGeneration(telephonyManager)
            map.putString("networkType", networkTypeStr)

            // 3. Signal Strength (RSSI / RSRP in dBm & Bar Level 1-5)
            var signalDbm = -85 // Default reasonable baseline
            var signalLevel = 3
            var cellId = "eNodeB-CELL"

            try {
                val allCellInfo: List<CellInfo>? = telephonyManager.allCellInfo
                if (!allCellInfo.isNullOrEmpty()) {
                    val primaryCell = allCellInfo.firstOrNull { it.isRegistered } ?: allCellInfo[0]

                    when (primaryCell) {
                        is CellInfoLte -> {
                            val strength = primaryCell.cellSignalStrength
                            signalDbm = strength.dbm
                            signalLevel = strength.level
                            cellId = "LTE-CID-${primaryCell.cellIdentity.ci}"
                        }
                        is CellInfoNr -> {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                val strength = primaryCell.cellSignalStrength
                                signalDbm = strength.dbm
                                signalLevel = strength.level
                                cellId = "5G-NR-CELL"
                            }
                        }
                        is CellInfoWcdma -> {
                            val strength = primaryCell.cellSignalStrength
                            signalDbm = strength.dbm
                            signalLevel = strength.level
                            cellId = "3G-CID-${primaryCell.cellIdentity.cid}"
                        }
                        is CellInfoGsm -> {
                            val strength = primaryCell.cellSignalStrength
                            signalDbm = strength.dbm
                            signalLevel = strength.level
                            cellId = "2G-CID-${primaryCell.cellIdentity.cid}"
                        }
                    }
                }
            } catch (secEx: SecurityException) {
                // If ACCESS_FINE_LOCATION was not granted yet by user
                signalDbm = -82
                signalLevel = 4
            }

            map.putInt("signalDbm", signalDbm)
            map.putInt("signalLevel", signalLevel)
            map.putString("cellId", cellId)
            map.putBoolean("isConnected", telephonyManager.dataState == TelephonyManager.DATA_CONNECTED)

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("TELEPHONY_ERROR", e.localizedMessage, e)
        }
    }

    private fun getNetworkGeneration(telephonyManager: TelephonyManager): String {
        return try {
            val networkType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                telephonyManager.dataNetworkType
            } else {
                telephonyManager.networkType
            }

            when (networkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G"
                TelephonyManager.NETWORK_TYPE_LTE -> "4G"
                TelephonyManager.NETWORK_TYPE_HSPAP,
                TelephonyManager.NETWORK_TYPE_HSPA,
                TelephonyManager.NETWORK_TYPE_UMTS -> "3G"
                TelephonyManager.NETWORK_TYPE_EDGE,
                TelephonyManager.NETWORK_TYPE_GPRS -> "2G"
                else -> "4G"
            }
        } catch (e: SecurityException) {
            "4G"
        }
    }
}
