import { OnDestroy } from 'angular2/core';
import { Router } from '../router';
export declare class RouterLink implements OnDestroy {
    private _router;
    target: string;
    private _changes;
    private _targetUrl;
    private _subscription;
    private href;
    constructor(_router: Router);
    ngOnDestroy(): void;
    routerLink: any[];
    onClick(): boolean;
    private _updateTargetUrlAndHref();
}
