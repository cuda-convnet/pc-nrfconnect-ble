/* Copyright (c) 2015 Nordic Semiconductor. All Rights Reserved.
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

export const ADAPTER_OPEN = 'ADAPTER_OPEN';
export const ADAPTER_OPENED = 'ADAPTER_OPENED';
export const ADAPTER_CLOSED = 'ADAPTER_CLOSED';
export const ADAPTER_ADDED = 'ADAPTER_ADDED';
export const ADAPTER_REMOVED = 'ADAPTER_REMOVED';
export const ADAPTER_ERROR = 'ADAPTER_ERROR';
export const ADAPTER_STATE_CHANGED = 'ADAPTER_STATE_CHANGED';

export const DEVICE_CONNECT = 'DEVICE_CONNECT';
export const DEVICE_CONNECTED = 'DEVICE_CONNECTED';
export const DEVICE_DISCONNECT = 'DEVICE_DISCONNECT';
export const DEVICE_DISCONNECTED = 'DEVICE_DISCONNECTED';
export const DEVICE_CANCEL_CONNECT = 'DEVICE_CANCEL_CONNECT';
export const DEVICE_CANCELLED_CONNECT = 'DEVICE_CANCELLED_CONNECT';

export const ERROR_OCCURED = 'ERROR_OCCURED';

import _ from 'underscore';

import { driver, api } from 'pc-ble-driver-js';

const _adapterFactory = api.AdapterFactory.getInstance(driver);

// Internal functions

// This function shall only be used by Promise.reject calls.
function makeError(data) {
    let {adapter, device, error} = data;

    return {
        adapter: adapter,
        device: device,
        error: error
    };
}

function _getAdapters(dispatch) {
    return new Promise((resolve, reject) => {
        _adapterFactory.getAdapters((error, adapters) => {
            if(error) {
                reject(makeError({error:error}));
            } else {
                resolve(adapters);
            }
        });
    }).then(adapters => {
        // Register listeners for adapters added/removed
        _adapterFactory.on('added', adapter => {
            dispatch(adapterAddedAction(adapter));
        });
        _adapterFactory.on('removed', adapter => {
            dispatch(adapterRemovedAction(adapter));
        });
        _adapterFactory.on('error', error => {
            dispatch(errorOccuredAction(undefined, error));
        });

        // Add the adapters to the store
        _.map(adapters, (adapter) => {
            dispatch(adapterAddedAction(adapter));
        });
    }).catch(error => {
        dispatch(errorOccuredAction(undefined, error));
    });
}

function _openAdapter(dispatch, getState, adapter) {
    return new Promise((resolve, reject) => {
        const options = {
            baudRate: 115200,
            parity: 'none',
            flowControl: 'none',
            eventInterval: 100,
            logLevel: 'trace',
        };

        // Check if we already have an adapter open
        if(getState().adapter.api.selectedAdapter !== null) {
            _closeAdapter(dispatch, getState().adapter.api.selectedAdapter);
        }

        const adapterToUse = _.find(getState().adapter.api.adapters, x => { return x.adapterState.port === adapter; });

        if(adapterToUse === null) {
            reject(makeError({error: `Not able to find ${adapter}.`}));
        }
        // Listen to errors from this adapter since we are opening it now
        adapterToUse.on('error', error => {
            // TODO: separate between what is an noen recoverable adapter error
            // TODO: and a recoverable error.
            // TODO: adapterErrorAction should only be used if it is an unrecoverable errors.
            // TODO: errorOccuredAction should be used for recoverable errors.
            dispatch(adapterErrorAction(adapterToUse, error));
        });

        // Listen to adapter changes
        adapterToUse.on('adapterStateChanged', adapterState => {
            dispatch(adapterStateChangedAction(adapterToUse, adapterState));
        });

        dispatch(adapterOpenAction(adapterToUse));

        adapterToUse.open(options, error => {
            if(error) {
                reject(makeError({adapter: adapterToUse, error: error}));
            } else {
                resolve(adapterToUse);
            }
        });
    }).then(adapter => {
        dispatch(adapterOpenedAction(adapter));
    }).catch(errorData => {
        dispatch(adapterErrorAction(errorData.adapter, errorData.error));
    });
}

function _closeAdapter(dispatch, adapter) {
    return new Promise((resolve, reject) => {
        adapter.close(error => {
            if(error) {
                reject(makeError({ adapter: adapter, error: error}));
            } else {
                resolve(adapter);
            }
        });
    }).then(adapter => {
        dispatch(adapterClosedAction(adapter));
    }).catch(errorData => {
        dispatch(adapterErrorAction(errorData.adapter, errorData.error));
    });
}

function adapterOpenedAction(adapter)
{
    return {
        type: ADAPTER_OPENED,
        adapter
    };
}

function adapterOpenAction(adapter)
{
    return {
        type: ADAPTER_OPEN,
        adapter
    };
}

function adapterClosedAction(adapter) {
    return {
        type: ADAPTER_CLOSED,
        adapter
    };
}

function adapterRemovedAction(adapter) {
    return {
        type: ADAPTER_REMOVED,
        adapter
    };
}

function adapterAddedAction(adapter) {
    return {
        type: ADAPTER_ADDED,
        adapter
    };
}

function adapterErrorAction(adapter, error) {
    return {
        type: ADAPTER_ERROR,
        adapter,
        error
    };
}

function adapterStateChangedAction(adapter, adapterState) {
    return {
        type: ADAPTER_STATE_CHANGED,
        adapter,
        adapterState
    };
}

function _connectToDevice(dispatch, getState, device) {
    return new Promise((resolve, reject) => {
        const connectionParameters = {
            min_conn_interval: 7.5,
            max_conn_interval: 7.5,
            slave_latency: 0,
            conn_sup_timeout: 4000,
        };

        const scanParameters = {
            active: true,
            interval: 100,
            window: 50,
            timeout: 20,
        };

        const options = {
            scanParams: scanParameters,
            connParams: connectionParameters
        };

        const adapterToUse = getState().adapter.api.selectedAdapter;

        if (adapterToUse === null) {
            reject(makeError({adapter: null, error: `No adapter selected`}));
        }

        dispatch(deviceConnectAction(device));

        adapterToUse.once('deviceConnected', device => {
            resolve(device);
        });

        adapterToUse.connect(
            { address: device.address, type: 'BLE_GAP_ADDR_TYPE_RANDOM_STATIC' },
            options,
            error => {
                if (error) {
                    reject(makeError({adapter: adapterToUse, device: device, error: error}));
                }
            }
        );
    }).then(device => {
        dispatch(deviceConnectedAction(device));
    }).catch(errorData => {
        dispatch(errorOccuredAction(errorData.adapter, errorData.error));
    });
}

function _disconnectFromDevice(dispatch, getState, device) {
}

function _cancelConnect(dispatch, getState) {
    return new Promise((resolve, reject) => {
        const adapterToUse = getState().adapter.api.selectedAdapter;

        if(adapterToUse === null) {
            reject(makeError({error: `No adapter selected`}));
        }

        dispatch(deviceCancelConnectAction());

        adapterToUse.cancelConnect(
            (error) => {
            if(error) {
                reject(makeError({adapter: adapterToUse, error: error}));
            }

            resolve();
        });
    }).then(device => {
        dispatch(deviceCancelledConnectAction());
    }).catch(error => {
        dispatch(errorOccuredAction(error.adapter, error.error));
    });
}

function deviceConnectAction(device) {
    return {
        type: DEVICE_CONNECT,
        device
    };
}

function deviceConnectedAction(device) {
    return {
        type: DEVICE_CONNECTED,
        device
    };
}

function deviceDisconnectedAction(device) {
    return {
        type: DEVICE_DISCONNECTED,
        device
    };
}

function deviceCancelledConnectAction() {
    return {
        type: DEVICE_CANCELLED_CONNECT,
    };
}

function deviceCancelConnectAction() {
    return {
        type: DEVICE_CANCEL_CONNECT,
    };
}


function errorOccuredAction(adapter, error) {
    return {
        type: ERROR_OCCURED,
        adapter,
        error
    };
}

export function findAdapters() {
    return dispatch => {
        return _getAdapters(dispatch);
    };
}

export function openAdapter(adapter) {
    return (dispatch, getState) => {
        return _openAdapter(dispatch, getState, adapter);
    };
}

export function closeAdapter(adapter) {
    return dispatch => {
        return _closeAdapter(dispatch, adapter);
    };
}

export function connectToDevice(device) {
    return (dispatch, getState) => {
        return _connectToDevice(dispatch, getState, device);
    };
}

export function disconnectFromDevice(device) {
    return (dispatch, getState) => {
        return _disconnectFromDevice(dispatch, getState, device);
    };
}

export function cancelConnect() {
    return (dispatch, getState) => {
        return _cancelConnect(dispatch, getState);
    };
}
