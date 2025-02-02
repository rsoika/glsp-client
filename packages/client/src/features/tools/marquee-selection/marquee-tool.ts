/********************************************************************************
 * Copyright (c) 2021-2023 EclipseSource and others.
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
import { injectable } from 'inversify';
import { Action, KeyListener, SModelElement } from '~glsp-sprotty';
import { EnableToolsAction } from '../../../base/tool-manager/tool';
import { BaseEditTool } from '../base-tools';
import { MarqueeMouseTool } from './marquee-mouse-tool';

@injectable()
export class MarqueeTool extends BaseEditTool {
    static ID = 'glsp.marquee-tool';

    protected marqueeKeyListener: MarqueeKeyListener = new MarqueeKeyListener();

    get id(): string {
        return MarqueeTool.ID;
    }

    enable(): void {
        this.toDisposeOnDisable.push(this.keyTool.registerListener(this.marqueeKeyListener));
    }
}

@injectable()
export class MarqueeKeyListener extends KeyListener {
    override keyDown(_element: SModelElement, event: KeyboardEvent): Action[] {
        if (event.shiftKey) {
            return [EnableToolsAction.create([MarqueeMouseTool.ID])];
        }
        return [];
    }
}
