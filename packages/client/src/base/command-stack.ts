/********************************************************************************
 * Copyright (c) 2019-2023 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { injectable, multiInject, optional, preDestroy } from 'inversify';
import {
    CommandStack,
    Disposable,
    DisposableCollection,
    Emitter,
    Event,
    ICommand,
    SModelRoot,
    SetModelCommand,
    TYPES,
    UpdateModelCommand
} from '~glsp-sprotty';

/**
 * A hook to listen for model root changes. Will be called after a server update
 * has been processed
 */
export interface ISModelRootListener {
    modelRootChanged(root: Readonly<SModelRoot>): void;
}

@injectable()
export class GLSPCommandStack extends CommandStack implements Disposable {
    @multiInject(TYPES.ISModelRootListener)
    @optional()
    protected modelRootListeners: ISModelRootListener[] = [];
    protected toDispose = new DisposableCollection();

    protected override initialize(): void {
        super.initialize();
        this.toDispose.push(this.onModelRootChangedEmitter);
        this.modelRootListeners.forEach(listener => this.onModelRootChanged(root => listener.modelRootChanged(root)));
    }

    @preDestroy()
    dispose(): void {
        this.toDispose.dispose();
    }

    protected onModelRootChangedEmitter = new Emitter<Readonly<SModelRoot>>();
    get onModelRootChanged(): Event<Readonly<SModelRoot>> {
        return this.onModelRootChangedEmitter.event;
    }

    override undo(): Promise<SModelRoot> {
        this.logger.warn(
            this,
            'GLSPCommandStack.undo() was called. This should never happen as the GLSP server is responsible for handling undo requests'
        );
        return this.currentModel;
    }

    override redo(): Promise<SModelRoot> {
        this.logger.warn(
            this,
            'GLSPCommandStack.redo() was called. This should never happen as the GLSP server is responsible for handling redo requests'
        );
        return this.currentModel;
    }

    override execute(command: ICommand): Promise<SModelRoot> {
        const result = super.execute(command);
        if (command instanceof SetModelCommand || command instanceof UpdateModelCommand) {
            result.then(root => this.notifyListeners(root));
        }
        return result;
    }

    protected notifyListeners(root: Readonly<SModelRoot>): void {
        this.onModelRootChangedEmitter.fire(root);
    }
}
