/* Copyright (c) 2016 Nordic Semiconductor. All Rights Reserved.
 *
 * The information contained herein is property of Nordic Semiconductor ASA.
 * Terms and conditions of usage are described in detail in NORDIC
 * SEMICONDUCTOR STANDARD SOFTWARE LICENSE AGREEMENT.
 *
 * Licensees are granted free, non-transferable use of the information. NO
 * WARRANTY of ANY KIND is provided. This heading must NOT be removed from
 * the file.
 *
 */

'use strict';

import fs from 'fs';
import {shell} from 'electron';
function openLogFile(path, err) {
    fs.exists(path, exists => {
        if (!exists) {
            err();
        }

        shell.openExternal(path);
    });
}

export { openLogFile };