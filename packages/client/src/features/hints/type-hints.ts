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
    CommandExecutionContext,
    CommandReturn,
    Connectable,
    EdgeTypeHint,
    FeatureSet,
    IActionHandler,
    ICommand,
    MaybePromise,
    RequestTypeHintsAction,
    SEdge,
    SModelElement,
    SModelRoot,
    SShapeElement,
    SetTypeHintsAction,
    ShapeTypeHint,
    TYPES,
    TypeHint,
    connectableFeature,
    deletableFeature,
    editFeature,
    moveFeature
} from '~glsp-sprotty';
import { GLSPActionDispatcher } from '../../base/action-dispatcher';
import { IFeedbackActionDispatcher } from '../../base/feedback/feedback-action-dispatcher';
import { FeedbackCommand } from '../../base/feedback/feedback-command';
import { IDiagramStartup } from '../../base/model/diagram-loader';
import { getElementTypeId, hasCompatibleType } from '../../utils/smodel-util';
import { resizeFeature } from '../change-bounds/model';
import { reconnectFeature } from '../reconnect/model';
import { Containable, containerFeature, reparentFeature } from './model';

/**
 * Is dispatched by the {@link TypeHintProvider} to apply the type hints received from the server
 * onto the graphical model. The action is dispatched as persistent feedback to ensure the applied type hints
 * don't get lost after a server-side model update.
 */
export interface ApplyTypeHintsAction extends Action {
    kind: typeof ApplyTypeHintsAction.KIND;
}

export namespace ApplyTypeHintsAction {
    export const KIND = 'applyTypeHints';

    export function is(object: any): object is ApplyTypeHintsAction {
        return Action.hasKind(object, KIND);
    }

    export function create(): ApplyTypeHintsAction {
        return { kind: KIND };
    }
}

@injectable()
export class ApplyTypeHintsCommand extends FeedbackCommand {
    public static KIND = ApplyTypeHintsAction.KIND;
    public override readonly priority = 10;

    @inject(TYPES.ITypeHintProvider) protected typeHintProvider: ITypeHintProvider;

    constructor(@inject(TYPES.Action) protected action: Action) {
        super();
    }

    execute(context: CommandExecutionContext): CommandReturn {
        context.root.index.all().forEach(element => {
            if (element instanceof SShapeElement || element instanceof SModelRoot) {
                this.applyShapeTypeHint(element);
            } else if (element instanceof SEdge) {
                return this.applyEdgeTypeHint(element);
            }
        });
        return context.root;
    }

    protected applyEdgeTypeHint(element: SModelElement): void {
        const hint = this.typeHintProvider.getEdgeTypeHint(element);
        if (hint && isModifiableFeatureSet(element.features)) {
            addOrRemove(element.features, deletableFeature, hint.deletable);
            addOrRemove(element.features, editFeature, hint.routable);
            addOrRemove(element.features, reconnectFeature, hint.repositionable);
        }
    }

    protected applyShapeTypeHint(element: SModelElement): void {
        const hint = this.typeHintProvider.getShapeTypeHint(element);
        if (hint && isModifiableFeatureSet(element.features)) {
            addOrRemove(element.features, deletableFeature, hint.deletable);
            addOrRemove(element.features, moveFeature, hint.repositionable);
            addOrRemove(element.features, resizeFeature, hint.resizable);
            addOrRemove(element.features, reparentFeature, hint.reparentable);

            addOrRemove(element.features, containerFeature, true);
            const containable = createContainable(hint);
            Object.assign(element, containable);

            addOrRemove(element.features, connectableFeature, true);
            const validSourceEdges = this.typeHintProvider.getValidEdgeElementTypes(element, 'source');
            const validTargetEdges = this.typeHintProvider.getValidEdgeElementTypes(element, 'target');
            const connectable = createConnectable(validSourceEdges, validTargetEdges);
            Object.assign(element, connectable);
        }
    }
}

function createConnectable(validSourceEdges: string[], validTargetEdges: string[]): Connectable {
    return {
        canConnect: (routable, role) =>
            role === 'source' ? validSourceEdges.includes(routable.type) : validTargetEdges.includes(routable.type)
    };
}

function createContainable(hint: ShapeTypeHint): Containable {
    return {
        isContainableElement: element =>
            hint.containableElementTypeIds ? hint.containableElementTypeIds.includes(getElementTypeId(element)) : false
    };
}

function addOrRemove(features: Set<symbol>, feature: symbol, add: boolean): void {
    if (add && !features.has(feature)) {
        features.add(feature);
    } else if (!add && features.has(feature)) {
        features.delete(feature);
    }
}

function isModifiableFeatureSet(featureSet?: FeatureSet): featureSet is FeatureSet & Set<symbol> {
    return featureSet !== undefined && featureSet instanceof Set;
}

export interface ITypeHintProvider {
    getShapeTypeHint(input: SModelElement | SModelElement | string): ShapeTypeHint | undefined;
    getEdgeTypeHint(input: SModelElement | SModelElement | string): EdgeTypeHint | undefined;
    getValidEdgeElementTypes(input: SModelElement | SModelElement | string, role: 'source' | 'target'): string[];
}

@injectable()
export class TypeHintProvider implements IActionHandler, ITypeHintProvider, IDiagramStartup {
    @inject(TYPES.IFeedbackActionDispatcher)
    protected feedbackActionDispatcher: IFeedbackActionDispatcher;

    @inject(GLSPActionDispatcher)
    protected actionDispatcher: GLSPActionDispatcher;

    protected shapeHints: Map<string, ShapeTypeHint> = new Map();
    protected edgeHints: Map<string, EdgeTypeHint> = new Map();

    handle(action: Action): ICommand | Action | void {
        if (SetTypeHintsAction.is(action)) {
            action.shapeHints.forEach(hint => this.shapeHints.set(hint.elementTypeId, hint));
            action.edgeHints.forEach(hint => this.edgeHints.set(hint.elementTypeId, hint));
            this.feedbackActionDispatcher.registerFeedback(this, [ApplyTypeHintsAction.create()]);
        }
    }

    getValidEdgeElementTypes(input: SModelElement | SModelElement | string, role: 'source' | 'target'): string[] {
        const elementTypeId = getElementTypeId(input);
        if (role === 'source') {
            return Array.from(
                Array.from(this.edgeHints.values())
                    .filter(hint =>
                        hint.sourceElementTypeIds.some(sourceElementTypeId => hasCompatibleType(elementTypeId, sourceElementTypeId))
                    )
                    .map(hint => hint.elementTypeId)
            );
        } else {
            return Array.from(
                Array.from(this.edgeHints.values())
                    .filter(hint =>
                        hint.targetElementTypeIds.some(targetElementTypeId => hasCompatibleType(elementTypeId, targetElementTypeId))
                    )
                    .map(hint => hint.elementTypeId)
            );
        }
    }

    getShapeTypeHint(input: SModelElement | SModelElement | string): ShapeTypeHint | undefined {
        return getTypeHint(input, this.shapeHints);
    }

    getEdgeTypeHint(input: SModelElement | SModelElement | string): EdgeTypeHint | undefined {
        return getTypeHint(input, this.edgeHints);
    }

    preRequestModel(): MaybePromise<void> {
        this.actionDispatcher.dispatch(RequestTypeHintsAction.create());
    }
}

function getTypeHint<T extends TypeHint>(input: SModelElement | SModelElement | string, hints: Map<string, T>): T | undefined {
    const type = getElementTypeId(input);
    let hint = hints.get(type);
    // Check subtypes
    if (hint === undefined) {
        const subtypes = type.split(':');
        while (hint === undefined && subtypes.length > 0) {
            subtypes.pop();
            hint = hints.get(subtypes.join(':'));
        }
    }
    return hint;
}
