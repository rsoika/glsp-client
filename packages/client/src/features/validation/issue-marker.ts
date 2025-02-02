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
import {
    Bounds,
    Marker,
    MarkerKind,
    Projectable,
    SDecoration,
    SIssue,
    SIssueMarker,
    SIssueSeverity,
    SParentElement,
    isBoundsAware
} from '~glsp-sprotty';

export class GIssueMarker extends SIssueMarker implements Projectable {
    constructor() {
        super();
        this.features = new Set<symbol>(SDecoration.DEFAULT_FEATURES);
    }
    projectionCssClasses: string[];
    projectedBounds?: Bounds;
    override issues: SIssue[] = [];
    override type = 'marker';

    computeProjectionCssClasses(): void {
        const severityCss = getSeverity(this);
        this.projectionCssClasses = ['sprotty-issue', 'sprotty-' + severityCss];
    }
}

/**
 * Retrieves the `SIssueMarker` contained by the provided model element as
 * direct child or a newly instantiated `SIssueMarker` if no child
 * `SIssueMarker` exists.
 * @param modelElement for which the `SIssueMarker` should be retrieved or created.
 * @returns the child `SIssueMarker` or a new `SIssueMarker` if no such child exists.
 */
export function getOrCreateSIssueMarker(modelElement: SParentElement): SIssueMarker {
    let issueMarker: GIssueMarker | undefined;

    issueMarker = getSIssueMarker(modelElement);

    if (issueMarker === undefined) {
        issueMarker = new GIssueMarker();
        if (isBoundsAware(modelElement)) {
            issueMarker.projectedBounds = modelElement.parentToLocal(modelElement.bounds);
        }
        modelElement.add(issueMarker);
    }

    return issueMarker;
}

/**
 * Retrieves the `SIssueMarker` contained by the provided model element as
 * direct child or `undefined` if such an `SIssueMarker` does not exist.
 * @param modelElement for which the `SIssueMarker` should be retrieved.
 * @returns the child `SIssueMarker` or `undefined` if no such child exists.
 */
export function getSIssueMarker(modelElement: SParentElement): GIssueMarker | undefined {
    let issueMarker: GIssueMarker | undefined;

    for (const child of modelElement.children) {
        if (child instanceof GIssueMarker) {
            issueMarker = child;
        }
    }

    return issueMarker;
}

/**
 * Creates an `SIssue` with `severity` and `message` set according to
 * the `kind` and `description` of the provided `Marker`.
 * @param marker `Marker` for that an `SIssue` should be created.
 * @returns the created `SIssue`.
 */
export function createSIssue(marker: Marker, parent?: SParentElement): SIssue {
    const issue = new SIssue();
    issue.message = marker.description;

    switch (marker.kind) {
        case MarkerKind.ERROR: {
            issue.severity = 'error';
            break;
        }
        case MarkerKind.INFO: {
            issue.severity = 'info';
            break;
        }
        case MarkerKind.WARNING: {
            issue.severity = 'warning';
            break;
        }
    }
    return issue;
}

export function getSeverity(marker: SIssueMarker): SIssueSeverity {
    let currentSeverity: SIssueSeverity = 'info';
    for (const severity of marker.issues.map(s => s.severity)) {
        if (severity === 'error') {
            return severity;
        }
        if (severity === 'warning' && currentSeverity === 'info') {
            currentSeverity = severity;
        }
    }
    return currentSeverity;
}
