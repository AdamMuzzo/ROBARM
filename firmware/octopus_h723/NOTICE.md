# Third-party board support

The files in `boards/` and `variants/MARLIN_H723ZE/` are copied from the
[Marlin firmware repository](https://github.com/MarlinFirmware/Marlin) and
ultimately from STMicroelectronics' STM32 Arduino core. Their source headers
and licenses remain authoritative. The variant source carries the
STMicroelectronics BSD 3-Clause notice.

The physical pin assignments are for the BIGTREETECH Octopus Pro V1.1 H723,
derived from BIGTREETECH's official schematic and Marlin's official board
definition. MOTOR3 uses PA2 for enable, as required by board revision 1.1.

