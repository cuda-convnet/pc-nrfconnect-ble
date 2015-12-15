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

import React, { PropTypes } from 'react';

import Component from 'react-pure-render/component';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { ipcRenderer } from 'electron';

import * as ServerSetupActions from '../actions/serverSetupActions';
import * as AdapterActions from '../actions/adapterActions';

import AddNewItem from '../components/AddNewItem';
import ServiceItem from '../components/ServiceItem';
import ServiceEditor from '../components/ServiceEditor';
import CharacteristicEditor from '../components/CharacteristicEditor';
import DescriptorEditor from '../components/DescriptorEditor';
import ConfirmationDialog from '../components/ConfirmationDialog';
import CentralDevice from '../components/CentralDevice';

import { getInstanceIds } from '../utils/api';

let loadServerSetupReplyHandle;
let saveServerSetupReplyHandle;

class ServerSetup extends Component {
    constructor(props) {
        super(props);

        this._setupFileDialogs();
    }

    _setupFileDialogs() {
        const {
            loadServerSetup,
            saveServerSetup,
        } = this.props;

        if (loadServerSetupReplyHandle) {
            ipcRenderer.removeListener('load-server-setup-reply', loadServerSetupReplyHandle);
        }

        const loadServerSetupReply = (event, filename) => {
            loadServerSetup(filename);
        };

        ipcRenderer.on('load-server-setup-reply', loadServerSetupReply);
        loadServerSetupReplyHandle = loadServerSetupReply;

        if (saveServerSetupReplyHandle) {
            ipcRenderer.removeListener('save-server-setup-reply', saveServerSetupReplyHandle);
        }

        const saveServerSetupReply = (event, filename) => {
            saveServerSetup(filename);
        };

        ipcRenderer.on('save-server-setup-reply', saveServerSetupReply);
        saveServerSetupReplyHandle = saveServerSetupReply;
    }

    _saveChangedAttribute(changedAttribute) {
        this.props.saveChangedAttribute(changedAttribute);
    }

    render() {
        const {
            selectedAdapter,
            serverSetup,
            selectComponent,
            toggleAttributeExpanded,
            addNewService,
            addNewCharacteristic,
            addNewDescriptor,
            removeAttribute,
            applyServer,
            clearServer,
            showDeleteDialog,
            hideDeleteDialog,
        } = this.props;

        if (!serverSetup) {
            return (<div className='server-setup' style={this.props.style} />);
        }

        const {
            selectedComponent,
            showingDeleteDialog,
            children,
        } = serverSetup;

        const instanceIds = getInstanceIds(selectedComponent);
        let selectedAttribute = null;
        let selectedIsDescriptor = false;
        let selectedIsCharacteristic = false;
        let selectedIsService = false;

        if (instanceIds.descriptor) {
            selectedAttribute = children.getIn([
                instanceIds.service, 'children',
                instanceIds.characteristic, 'children',
                instanceIds.descriptor,
            ]);
            selectedIsDescriptor = true;
        } else if (instanceIds.characteristic) {
            selectedAttribute = children.getIn([
                instanceIds.service, 'children',
                instanceIds.characteristic,
            ]);
            selectedIsCharacteristic = true;
        } else if (instanceIds.service) {
            selectedAttribute = children.getIn([instanceIds.service]);
            selectedIsService = true;
        }

        const editorBorderClass = selectedAttribute ? ' selected-component-editor-border' : '';
        const editor = selectedIsService ? <ServiceEditor service={selectedAttribute}
                                                          onSaveChangedAttribute={changedAttribute => this._saveChangedAttribute(changedAttribute)}
                                                          onRemoveAttribute={showDeleteDialog} />
                     : selectedIsCharacteristic ? <CharacteristicEditor characteristic={selectedAttribute}
                                                                        onSaveChangedAttribute={changedAttribute => this._saveChangedAttribute(changedAttribute)}
                                                                        onRemoveAttribute={showDeleteDialog} />
                     : selectedIsDescriptor ? <DescriptorEditor descriptor={selectedAttribute}
                                                                onSaveChangedAttribute={changedAttribute => this._saveChangedAttribute(changedAttribute)}
                                                                onRemoveAttribute={showDeleteDialog} />
                     : <div className='nothing-selected' />;

        const services = [];

        children.forEach((service, i) => {
            services.push(
                <ServiceItem key={i}
                             item={service}
                             selectOnClick={true}
                             selected={selectedComponent}
                             onSelected={this._onSelected}
                             onSelectAttribute={selectComponent}
                             onToggleAttributeExpanded={toggleAttributeExpanded}
                             addNew={true}
                             onAddCharacteristic={addNewCharacteristic}
                             onAddDescriptor={addNewDescriptor} />
            );
        });

        const central = <CentralDevice id={selectedAdapter.instanceId + '_serversetup'}
            name={selectedAdapter.state.name}
            address={selectedAdapter.state.address}
            onSaveSetup={() => {
                ipcRenderer.send('save-server-setup', null);
            }}
            onLoadSetup={() => {
                ipcRenderer.send('load-server-setup', null);
            }}
         />;

        return (
            <div className='server-setup' style={this.props.style}>
                <div className='server-setup-view'>
                    <div className='server-setup-tree'>
                        {central}
                        <div className='service-items-wrap'>
                            {services}
                            <AddNewItem text='New service' id='add-btn-root' bars={1} parentInstanceId={'local.server'} selected={selectedComponent} onClick={addNewService} />
                        </div>
                        <div className='server-setup-buttons'>
                            <button type='button' className='btn btn-primary btn-nordic' onClick={applyServer}>Apply</button>
                            <button type='button' className='btn btn-primary btn-nordic' onClick={clearServer}>Clear</button>
                        </div>
                    </div>
                    <div className={'item-editor' + editorBorderClass}>
                        {editor}
                    </div>
                    <ConfirmationDialog show={showingDeleteDialog}
                                        onOk={removeAttribute}
                                        onCancel={hideDeleteDialog}
                                        text='Do you want to delete?'/>
                </div>
            </div>
        );
    }
}

function mapStateToProps(state) {
    const selectedAdapter = state.adapter.getIn(['adapters', state.adapter.selectedAdapter]);

    if (!selectedAdapter) {
        return {};
    }

    return {
        selectedAdapter: selectedAdapter,
        serverSetup: selectedAdapter.serverSetup,
    };
}

function mapDispatchToProps(dispatch) {
    let retval = Object.assign(
            {},
            bindActionCreators(ServerSetupActions, dispatch),
            bindActionCreators(AdapterActions, dispatch)
        );

    return retval;
}

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ServerSetup);

ServerSetup.propTypes = {
    serverSetup: PropTypes.object,
};
