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
import { inject, injectable } from 'inversify';
import {
    Action,
    EditLabelValidationResult,
    EditableLabel,
    IEditLabelValidationDecorator,
    IEditLabelValidator,
    RequestEditValidationAction,
    SModelElement,
    SetEditValidationResultAction,
    Severity,
    TYPES,
    ValidationStatus
} from '~glsp-sprotty';
import { GLSPActionDispatcher } from '../../base/action-dispatcher';

export namespace LabelEditValidation {
    export const CONTEXT_ID = 'label-edit';

    export function toEditLabelValidationResult(status: ValidationStatus): EditLabelValidationResult {
        const message = status.message;
        let severity = 'ok' as Severity;
        if (ValidationStatus.isError(status)) {
            severity = 'error' as Severity;
        } else if (ValidationStatus.isWarning(status)) {
            severity = 'warning' as Severity;
        }
        return { message, severity };
    }

    export function createValidationRequestAction(value: string, labelId: string): RequestEditValidationAction {
        return RequestEditValidationAction.create({ contextId: CONTEXT_ID, modelElementId: labelId, text: value });
    }
}

@injectable()
export class ServerEditLabelValidator implements IEditLabelValidator {
    @inject(TYPES.IActionDispatcher) protected actionDispatcher: GLSPActionDispatcher;

    validate(value: string, label: EditableLabel & SModelElement): Promise<EditLabelValidationResult> {
        const action = LabelEditValidation.createValidationRequestAction(value, label.id);
        return this.actionDispatcher.requestUntil(action).then(response => this.getValidationResultFromResponse(response));
    }

    getValidationResultFromResponse(action: Action): EditLabelValidationResult {
        if (SetEditValidationResultAction.is(action)) {
            return LabelEditValidation.toEditLabelValidationResult(action.status);
        }
        return { severity: 'ok' as Severity };
    }
}

@injectable()
export class BalloonLabelValidationDecorator implements IEditLabelValidationDecorator {
    decorate(input: HTMLInputElement, result: EditLabelValidationResult): void {
        const containerElement = input.parentElement;
        if (!containerElement) {
            return;
        }
        if (result.message) {
            containerElement.setAttribute('data-balloon', result.message);
            containerElement.setAttribute('data-balloon-pos', 'up-left');
            containerElement.setAttribute('data-balloon-visible', 'true');
        }
        switch (result.severity) {
            case 'ok':
                containerElement.classList.add('validation-ok');
                break;
            case 'warning':
                containerElement.classList.add('validation-warning');
                break;
            case 'error':
                containerElement.classList.add('validation-error');
                break;
        }
    }

    dispose(input: HTMLInputElement): void {
        const containerElement = input.parentElement;
        if (containerElement) {
            containerElement.removeAttribute('data-balloon');
            containerElement.removeAttribute('data-balloon-pos');
            containerElement.removeAttribute('data-balloon-visible');
            containerElement.classList.remove('validation-ok', 'validation-warning', 'validation-error');
        }
    }
}
