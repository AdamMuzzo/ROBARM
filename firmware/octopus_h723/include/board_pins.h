#pragma once

#include <Arduino.h>

namespace robarm {

constexpr uint8_t kMotorCount = 8;
constexpr uint8_t kJointCount = 6;
constexpr uint8_t kStopCount = 8;

// BIGTREETECH Octopus Pro V1.1, STM32H723. MOTOR3 EN changed to PA2 on V1.1.
constexpr uint32_t kEnablePins[kMotorCount] = {
    PF14, PF15, PG5, PA2, PG2, PF1, PD4, PE0};
constexpr uint32_t kStepPins[kMotorCount] = {
    PF13, PG0, PF11, PG4, PF9, PC13, PE2, PE6};
constexpr uint32_t kDirectionPins[kMotorCount] = {
    PF12, PG1, PG3, PC1, PF10, PF0, PE3, PA14};
constexpr uint32_t kChipSelectPins[kMotorCount] = {
    PC4, PD11, PC6, PC7, PF2, PE4, PE1, PD3};

constexpr uint32_t kTmcSckPin = PA5;
constexpr uint32_t kTmcMisoPin = PA6;
constexpr uint32_t kTmcMosiPin = PA7;

// BIGTREETECH Octopus Pro V1.1 FAN0 low-side MOSFET control.
// The adjacent voltage-selection jumper must be physically set to 5 V for the
// installed Noctua NF-A4x20 5V fan.
constexpr uint32_t kControllerFanPin = PA8;

constexpr uint32_t kStopPins[kStopCount] = {
    PG6, PG9, PG10, PG11, PG12, PG13, PG14, PG15};

}  // namespace robarm
