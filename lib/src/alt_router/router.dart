library angular2.src.alt_router.router;

import "dart:async";
import "package:angular2/core.dart"
    show OnInit, provide, ReflectiveInjector, ComponentResolver;
import "directives/router_outlet.dart" show RouterOutlet;
import "package:angular2/src/facade/lang.dart" show Type, isBlank, isPresent;
import "package:angular2/src/facade/async.dart" show EventEmitter, Stream;
import "package:angular2/src/facade/collection.dart" show StringMapWrapper;
import "package:angular2/src/facade/exceptions.dart" show BaseException;
import "router_url_serializer.dart" show RouterUrlSerializer;
import "recognize.dart" show recognize;
import "package:angular2/platform/common.dart" show Location;
import "segments.dart"
    show
        equalSegments,
        routeSegmentComponentFactory,
        RouteSegment,
        Tree,
        rootNode,
        TreeNode,
        UrlSegment,
        serializeRouteSegmentTree;
import "lifecycle_reflector.dart" show hasLifecycleHook;
import "constants.dart" show DEFAULT_OUTLET_NAME;

class RouterOutletMap {
  /** @internal */
  Map<String, RouterOutlet> _outlets = {};
  void registerOutlet(String name, RouterOutlet outlet) {
    this._outlets[name] = outlet;
  }
}

class Router {
  Type _componentType;
  ComponentResolver _componentResolver;
  RouterUrlSerializer _urlSerializer;
  RouterOutletMap _routerOutletMap;
  Location _location;
  Tree<RouteSegment> _prevTree;
  Tree<UrlSegment> _urlTree;
  EventEmitter _changes = new EventEmitter();
  Router(this._componentType, this._componentResolver, this._urlSerializer,
      this._routerOutletMap, this._location) {
    this.navigateByUrl(this._location.path());
  }
  Tree<UrlSegment> get urlTree {
    return this._urlTree;
  }

  Future navigate(Tree<UrlSegment> url) {
    this._urlTree = url;
    return recognize(this._componentResolver, this._componentType, url)
        .then((currTree) {
      new _LoadSegments(currTree, this._prevTree).load(this._routerOutletMap);
      this._prevTree = currTree;
      this._location.go(this._urlSerializer.serialize(this._urlTree));
      this._changes.emit(null);
    });
  }

  String serializeUrl(Tree<UrlSegment> url) {
    return this._urlSerializer.serialize(url);
  }

  Future navigateByUrl(String url) {
    return this.navigate(this._urlSerializer.parse(url));
  }

  Stream get changes {
    return this._changes;
  }
}

class _LoadSegments {
  Tree<RouteSegment> currTree;
  Tree<RouteSegment> prevTree;
  _LoadSegments(this.currTree, this.prevTree) {}
  void load(RouterOutletMap parentOutletMap) {
    var prevRoot = isPresent(this.prevTree) ? rootNode(this.prevTree) : null;
    var currRoot = rootNode(this.currTree);
    this.loadChildSegments(currRoot, prevRoot, parentOutletMap);
  }

  void loadSegments(TreeNode<RouteSegment> currNode,
      TreeNode<RouteSegment> prevNode, RouterOutletMap parentOutletMap) {
    var curr = currNode.value;
    var prev = isPresent(prevNode) ? prevNode.value : null;
    var outlet = this.getOutlet(parentOutletMap, currNode.value);
    if (equalSegments(curr, prev)) {
      this.loadChildSegments(currNode, prevNode, outlet.outletMap);
    } else {
      var outletMap = new RouterOutletMap();
      this.loadNewSegment(outletMap, curr, prev, outlet);
      this.loadChildSegments(currNode, prevNode, outletMap);
    }
  }

  void loadNewSegment(RouterOutletMap outletMap, RouteSegment curr,
      RouteSegment prev, RouterOutlet outlet) {
    var resolved = ReflectiveInjector.resolve([
      provide(RouterOutletMap, useValue: outletMap),
      provide(RouteSegment, useValue: curr)
    ]);
    var ref =
        outlet.load(routeSegmentComponentFactory(curr), resolved, outletMap);
    if (hasLifecycleHook("routerOnActivate", ref.instance)) {
      ref.instance.routerOnActivate(curr, prev, this.currTree, this.prevTree);
    }
  }

  void loadChildSegments(TreeNode<RouteSegment> currNode,
      TreeNode<RouteSegment> prevNode, RouterOutletMap outletMap) {
    var prevChildren = isPresent(prevNode)
        ? prevNode.children.fold({}, (m, c) {
            m[c.value.outlet] = c;
            return m;
          })
        : {};
    currNode.children.forEach((c) {
      this.loadSegments(c, prevChildren[c.value.outlet], outletMap);
      StringMapWrapper.delete(prevChildren, c.value.outlet);
    });
    StringMapWrapper.forEach(
        prevChildren, (v, k) => this.unloadOutlet(outletMap._outlets[k]));
  }

  RouterOutlet getOutlet(RouterOutletMap outletMap, RouteSegment segment) {
    var outlet = outletMap._outlets[segment.outlet];
    if (isBlank(outlet)) {
      if (segment.outlet == DEFAULT_OUTLET_NAME) {
        throw new BaseException('''Cannot find default outlet''');
      } else {
        throw new BaseException(
            '''Cannot find the outlet ${ segment . outlet}''');
      }
    }
    return outlet;
  }

  void unloadOutlet(RouterOutlet outlet) {
    StringMapWrapper.forEach(outlet.outletMap._outlets, (v, k) {
      this.unloadOutlet(v);
    });
    outlet.unload();
  }
}
