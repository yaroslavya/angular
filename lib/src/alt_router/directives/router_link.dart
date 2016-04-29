library angular2.src.alt_router.directives.router_link;

import "package:angular2/core.dart"
    show
        ResolvedReflectiveProvider,
        Directive,
        DynamicComponentLoader,
        ViewContainerRef,
        Attribute,
        ComponentRef,
        ComponentFactory,
        ReflectiveInjector,
        OnInit,
        HostListener,
        HostBinding,
        Input,
        OnDestroy;
import "../router.dart" show RouterOutletMap, Router;
import "../segments.dart" show RouteSegment, UrlSegment, Tree;
import "../link.dart" show link;
import "package:angular2/src/facade/lang.dart" show isString;
import "package:angular2/src/facade/async.dart" show ObservableWrapper;

@Directive(selector: "[routerLink]")
class RouterLink implements OnDestroy {
  Router _router;
  @Input()
  String target;
  List<dynamic> _changes = [];
  Tree<UrlSegment> _targetUrl;
  dynamic _subscription;
  @HostBinding()
  String href;
  RouterLink(this._router) {
    this._subscription = ObservableWrapper.subscribe(_router.changes, (_) {
      this._targetUrl = _router.urlTree;
      this._updateTargetUrlAndHref();
    });
  }
  ngOnDestroy() {
    ObservableWrapper.dispose(this._subscription);
  }

  @Input()
  set routerLink(List<dynamic> data) {
    this._changes = data;
    this._updateTargetUrlAndHref();
  }

  @HostListener("click")
  bool onClick() {
    if (!isString(this.target) || this.target == "_self") {
      this._router.navigate(this._targetUrl);
      return false;
    }
    return true;
  }

  void _updateTargetUrlAndHref() {
    this._targetUrl = link(null, this._router.urlTree, this._changes);
    this.href = this._router.serializeUrl(this._targetUrl);
  }
}
