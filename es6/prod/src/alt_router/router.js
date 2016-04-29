import { provide, ReflectiveInjector } from 'angular2/core';
import { isBlank, isPresent } from 'angular2/src/facade/lang';
import { EventEmitter } from 'angular2/src/facade/async';
import { StringMapWrapper } from 'angular2/src/facade/collection';
import { BaseException } from 'angular2/src/facade/exceptions';
import { recognize } from './recognize';
import { equalSegments, routeSegmentComponentFactory, RouteSegment, rootNode } from './segments';
import { hasLifecycleHook } from './lifecycle_reflector';
import { DEFAULT_OUTLET_NAME } from './constants';
export class RouterOutletMap {
    constructor() {
        /** @internal */
        this._outlets = {};
    }
    registerOutlet(name, outlet) { this._outlets[name] = outlet; }
}
export class Router {
    constructor(_componentType, _componentResolver, _urlSerializer, _routerOutletMap, _location) {
        this._componentType = _componentType;
        this._componentResolver = _componentResolver;
        this._urlSerializer = _urlSerializer;
        this._routerOutletMap = _routerOutletMap;
        this._location = _location;
        this._changes = new EventEmitter();
        this.navigateByUrl(this._location.path());
    }
    get urlTree() { return this._urlTree; }
    navigate(url) {
        this._urlTree = url;
        return recognize(this._componentResolver, this._componentType, url)
            .then(currTree => {
            new _LoadSegments(currTree, this._prevTree).load(this._routerOutletMap);
            this._prevTree = currTree;
            this._location.go(this._urlSerializer.serialize(this._urlTree));
            this._changes.emit(null);
        });
    }
    serializeUrl(url) { return this._urlSerializer.serialize(url); }
    navigateByUrl(url) {
        return this.navigate(this._urlSerializer.parse(url));
    }
    get changes() { return this._changes; }
}
class _LoadSegments {
    constructor(currTree, prevTree) {
        this.currTree = currTree;
        this.prevTree = prevTree;
    }
    load(parentOutletMap) {
        let prevRoot = isPresent(this.prevTree) ? rootNode(this.prevTree) : null;
        let currRoot = rootNode(this.currTree);
        this.loadChildSegments(currRoot, prevRoot, parentOutletMap);
    }
    loadSegments(currNode, prevNode, parentOutletMap) {
        let curr = currNode.value;
        let prev = isPresent(prevNode) ? prevNode.value : null;
        let outlet = this.getOutlet(parentOutletMap, currNode.value);
        if (equalSegments(curr, prev)) {
            this.loadChildSegments(currNode, prevNode, outlet.outletMap);
        }
        else {
            let outletMap = new RouterOutletMap();
            this.loadNewSegment(outletMap, curr, prev, outlet);
            this.loadChildSegments(currNode, prevNode, outletMap);
        }
    }
    loadNewSegment(outletMap, curr, prev, outlet) {
        let resolved = ReflectiveInjector.resolve([provide(RouterOutletMap, { useValue: outletMap }), provide(RouteSegment, { useValue: curr })]);
        let ref = outlet.load(routeSegmentComponentFactory(curr), resolved, outletMap);
        if (hasLifecycleHook("routerOnActivate", ref.instance)) {
            ref.instance.routerOnActivate(curr, prev, this.currTree, this.prevTree);
        }
    }
    loadChildSegments(currNode, prevNode, outletMap) {
        let prevChildren = isPresent(prevNode) ?
            prevNode.children.reduce((m, c) => {
                m[c.value.outlet] = c;
                return m;
            }, {}) :
            {};
        currNode.children.forEach(c => {
            this.loadSegments(c, prevChildren[c.value.outlet], outletMap);
            StringMapWrapper.delete(prevChildren, c.value.outlet);
        });
        StringMapWrapper.forEach(prevChildren, (v, k) => this.unloadOutlet(outletMap._outlets[k]));
    }
    getOutlet(outletMap, segment) {
        let outlet = outletMap._outlets[segment.outlet];
        if (isBlank(outlet)) {
            if (segment.outlet == DEFAULT_OUTLET_NAME) {
                throw new BaseException(`Cannot find default outlet`);
            }
            else {
                throw new BaseException(`Cannot find the outlet ${segment.outlet}`);
            }
        }
        return outlet;
    }
    unloadOutlet(outlet) {
        StringMapWrapper.forEach(outlet.outletMap._outlets, (v, k) => { this.unloadOutlet(v); });
        outlet.unload();
    }
}
