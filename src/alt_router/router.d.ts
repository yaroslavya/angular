import { ComponentResolver } from 'angular2/core';
import { RouterOutlet } from './directives/router_outlet';
import { Type } from 'angular2/src/facade/lang';
import { Observable } from 'angular2/src/facade/async';
import { RouterUrlSerializer } from './router_url_serializer';
import { Location } from 'angular2/platform/common';
import { Tree, UrlSegment } from './segments';
export declare class RouterOutletMap {
    registerOutlet(name: string, outlet: RouterOutlet): void;
}
export declare class Router {
    private _componentType;
    private _componentResolver;
    private _urlSerializer;
    private _routerOutletMap;
    private _location;
    private _prevTree;
    private _urlTree;
    private _changes;
    constructor(_componentType: Type, _componentResolver: ComponentResolver, _urlSerializer: RouterUrlSerializer, _routerOutletMap: RouterOutletMap, _location: Location);
    urlTree: Tree<UrlSegment>;
    navigate(url: Tree<UrlSegment>): Promise<void>;
    serializeUrl(url: Tree<UrlSegment>): string;
    navigateByUrl(url: string): Promise<void>;
    changes: Observable<void>;
}
