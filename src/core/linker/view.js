'use strict';"use strict";
var collection_1 = require('angular2/src/facade/collection');
var element_1 = require('./element');
var lang_1 = require('angular2/src/facade/lang');
var async_1 = require('angular2/src/facade/async');
var view_ref_1 = require('./view_ref');
var view_type_1 = require('./view_type');
var view_utils_1 = require('./view_utils');
var change_detection_1 = require('angular2/src/core/change_detection/change_detection');
var profile_1 = require('../profile/profile');
var exceptions_1 = require('./exceptions');
var debug_context_1 = require('./debug_context');
var element_injector_1 = require('./element_injector');
var _scope_check = profile_1.wtfCreateScope("AppView#check(ascii id)");
/**
 * Cost of making objects: http://jsperf.com/instantiate-size-of-object
 *
 */
var AppView = (function () {
    function AppView(clazz, componentType, type, viewUtils, parentInjector, declarationAppElement, cdMode, staticNodeDebugInfos) {
        this.clazz = clazz;
        this.componentType = componentType;
        this.type = type;
        this.viewUtils = viewUtils;
        this.parentInjector = parentInjector;
        this.declarationAppElement = declarationAppElement;
        this.cdMode = cdMode;
        this.staticNodeDebugInfos = staticNodeDebugInfos;
        this.contentChildren = [];
        this.viewChildren = [];
        this.viewContainerElement = null;
        // The names of the below fields must be kept in sync with codegen_name_util.ts or
        // change detection will fail.
        this.cdState = change_detection_1.ChangeDetectorState.NeverChecked;
        this.destroyed = false;
        this._currentDebugContext = null;
        this.ref = new view_ref_1.ViewRef_(this);
        if (type === view_type_1.ViewType.COMPONENT || type === view_type_1.ViewType.HOST) {
            this.renderer = viewUtils.renderComponent(componentType);
        }
        else {
            this.renderer = declarationAppElement.parentView.renderer;
        }
    }
    AppView.prototype.create = function (context, givenProjectableNodes, rootSelectorOrNode) {
        this.context = context;
        var projectableNodes;
        switch (this.type) {
            case view_type_1.ViewType.COMPONENT:
                projectableNodes = view_utils_1.ensureSlotCount(givenProjectableNodes, this.componentType.slotCount);
                break;
            case view_type_1.ViewType.EMBEDDED:
                projectableNodes = this.declarationAppElement.parentView.projectableNodes;
                break;
            case view_type_1.ViewType.HOST:
                // Note: Don't ensure the slot count for the projectableNodes as we store
                // them only for the contained component view (which will later check the slot count...)
                projectableNodes = givenProjectableNodes;
                break;
        }
        this._hasExternalHostElement = lang_1.isPresent(rootSelectorOrNode);
        this.projectableNodes = projectableNodes;
        if (this.debugMode) {
            this._resetDebug();
            try {
                return this.createInternal(rootSelectorOrNode);
            }
            catch (e) {
                this._rethrowWithContext(e, e.stack);
                throw e;
            }
        }
        else {
            return this.createInternal(rootSelectorOrNode);
        }
    };
    /**
     * Overwritten by implementations.
     * Returns the AppElement for the host element for ViewType.HOST.
     */
    AppView.prototype.createInternal = function (rootSelectorOrNode) { return null; };
    AppView.prototype.init = function (rootNodesOrAppElements, allNodes, disposables, subscriptions) {
        this.rootNodesOrAppElements = rootNodesOrAppElements;
        this.allNodes = allNodes;
        this.disposables = disposables;
        this.subscriptions = subscriptions;
        if (this.type === view_type_1.ViewType.COMPONENT) {
            // Note: the render nodes have been attached to their host element
            // in the ViewFactory already.
            this.declarationAppElement.parentView.viewChildren.push(this);
            this.renderParent = this.declarationAppElement.parentView;
            this.dirtyParentQueriesInternal();
        }
    };
    AppView.prototype.selectOrCreateHostElement = function (elementName, rootSelectorOrNode, debugCtx) {
        var hostElement;
        if (lang_1.isPresent(rootSelectorOrNode)) {
            hostElement = this.renderer.selectRootElement(rootSelectorOrNode, debugCtx);
        }
        else {
            hostElement = this.renderer.createElement(null, elementName, debugCtx);
        }
        return hostElement;
    };
    AppView.prototype.injectorGet = function (token, nodeIndex, notFoundResult) {
        if (this.debugMode) {
            this._resetDebug();
            try {
                return this.injectorGetInternal(token, nodeIndex, notFoundResult);
            }
            catch (e) {
                this._rethrowWithContext(e, e.stack);
                throw e;
            }
        }
        else {
            return this.injectorGetInternal(token, nodeIndex, notFoundResult);
        }
    };
    /**
     * Overwritten by implementations
     */
    AppView.prototype.injectorGetInternal = function (token, nodeIndex, notFoundResult) {
        return notFoundResult;
    };
    AppView.prototype.injector = function (nodeIndex) {
        if (lang_1.isPresent(nodeIndex)) {
            return new element_injector_1.ElementInjector(this, nodeIndex);
        }
        else {
            return this.parentInjector;
        }
    };
    AppView.prototype.destroy = function () {
        if (this._hasExternalHostElement) {
            this.renderer.detachView(this.flatRootNodes);
        }
        else if (lang_1.isPresent(this.viewContainerElement)) {
            this.viewContainerElement.detachView(this.viewContainerElement.nestedViews.indexOf(this));
        }
        this._destroyRecurse();
    };
    AppView.prototype._destroyRecurse = function () {
        if (this.destroyed) {
            return;
        }
        var children = this.contentChildren;
        for (var i = 0; i < children.length; i++) {
            children[i]._destroyRecurse();
        }
        children = this.viewChildren;
        for (var i = 0; i < children.length; i++) {
            children[i]._destroyRecurse();
        }
        if (this.debugMode) {
            this._resetDebug();
            try {
                this._destroyLocal();
            }
            catch (e) {
                this._rethrowWithContext(e, e.stack);
                throw e;
            }
        }
        else {
            this._destroyLocal();
        }
        this.destroyed = true;
    };
    AppView.prototype._destroyLocal = function () {
        var hostElement = this.type === view_type_1.ViewType.COMPONENT ? this.declarationAppElement.nativeElement : null;
        for (var i = 0; i < this.disposables.length; i++) {
            this.disposables[i]();
        }
        for (var i = 0; i < this.subscriptions.length; i++) {
            async_1.ObservableWrapper.dispose(this.subscriptions[i]);
        }
        this.destroyInternal();
        if (this._hasExternalHostElement) {
            this.renderer.detachView(this.flatRootNodes);
        }
        else if (lang_1.isPresent(this.viewContainerElement)) {
            this.viewContainerElement.detachView(this.viewContainerElement.nestedViews.indexOf(this));
        }
        else {
            this.dirtyParentQueriesInternal();
        }
        this.renderer.destroyView(hostElement, this.allNodes);
    };
    /**
     * Overwritten by implementations
     */
    AppView.prototype.destroyInternal = function () { };
    Object.defineProperty(AppView.prototype, "debugMode", {
        get: function () { return lang_1.isPresent(this.staticNodeDebugInfos); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppView.prototype, "changeDetectorRef", {
        get: function () { return this.ref; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppView.prototype, "parent", {
        get: function () {
            return lang_1.isPresent(this.declarationAppElement) ? this.declarationAppElement.parentView : null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppView.prototype, "flatRootNodes", {
        get: function () { return view_utils_1.flattenNestedViewRenderNodes(this.rootNodesOrAppElements); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppView.prototype, "lastRootNode", {
        get: function () {
            var lastNode = this.rootNodesOrAppElements.length > 0 ?
                this.rootNodesOrAppElements[this.rootNodesOrAppElements.length - 1] :
                null;
            return _findLastRenderNode(lastNode);
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Overwritten by implementations
     */
    AppView.prototype.dirtyParentQueriesInternal = function () { };
    AppView.prototype.addRenderContentChild = function (view) {
        this.contentChildren.push(view);
        view.renderParent = this;
        view.dirtyParentQueriesInternal();
    };
    AppView.prototype.removeContentChild = function (view) {
        collection_1.ListWrapper.remove(this.contentChildren, view);
        view.dirtyParentQueriesInternal();
        view.renderParent = null;
    };
    AppView.prototype.detectChanges = function (throwOnChange) {
        var s = _scope_check(this.clazz);
        if (this.cdMode === change_detection_1.ChangeDetectionStrategy.Detached ||
            this.cdMode === change_detection_1.ChangeDetectionStrategy.Checked ||
            this.cdState === change_detection_1.ChangeDetectorState.Errored)
            return;
        if (this.destroyed) {
            this.throwDestroyedError('detectChanges');
        }
        if (this.debugMode) {
            this._resetDebug();
            try {
                this.detectChangesInternal(throwOnChange);
            }
            catch (e) {
                this._rethrowWithContext(e, e.stack);
                throw e;
            }
        }
        else {
            this.detectChangesInternal(throwOnChange);
        }
        if (this.cdMode === change_detection_1.ChangeDetectionStrategy.CheckOnce)
            this.cdMode = change_detection_1.ChangeDetectionStrategy.Checked;
        this.cdState = change_detection_1.ChangeDetectorState.CheckedBefore;
        profile_1.wtfLeave(s);
    };
    /**
     * Overwritten by implementations
     */
    AppView.prototype.detectChangesInternal = function (throwOnChange) {
        this.detectContentChildrenChanges(throwOnChange);
        this.detectViewChildrenChanges(throwOnChange);
    };
    AppView.prototype.detectContentChildrenChanges = function (throwOnChange) {
        for (var i = 0; i < this.contentChildren.length; ++i) {
            this.contentChildren[i].detectChanges(throwOnChange);
        }
    };
    AppView.prototype.detectViewChildrenChanges = function (throwOnChange) {
        for (var i = 0; i < this.viewChildren.length; ++i) {
            this.viewChildren[i].detectChanges(throwOnChange);
        }
    };
    AppView.prototype.addToContentChildren = function (renderAppElement) {
        renderAppElement.parentView.contentChildren.push(this);
        this.viewContainerElement = renderAppElement;
        this.dirtyParentQueriesInternal();
    };
    AppView.prototype.removeFromContentChildren = function (renderAppElement) {
        collection_1.ListWrapper.remove(renderAppElement.parentView.contentChildren, this);
        this.dirtyParentQueriesInternal();
        this.viewContainerElement = null;
    };
    AppView.prototype.markAsCheckOnce = function () { this.cdMode = change_detection_1.ChangeDetectionStrategy.CheckOnce; };
    AppView.prototype.markPathToRootAsCheckOnce = function () {
        var c = this;
        while (lang_1.isPresent(c) && c.cdMode !== change_detection_1.ChangeDetectionStrategy.Detached) {
            if (c.cdMode === change_detection_1.ChangeDetectionStrategy.Checked) {
                c.cdMode = change_detection_1.ChangeDetectionStrategy.CheckOnce;
            }
            c = c.renderParent;
        }
    };
    AppView.prototype._resetDebug = function () { this._currentDebugContext = null; };
    AppView.prototype.debug = function (nodeIndex, rowNum, colNum) {
        return this._currentDebugContext = new debug_context_1.DebugContext(this, nodeIndex, rowNum, colNum);
    };
    AppView.prototype._rethrowWithContext = function (e, stack) {
        if (!(e instanceof exceptions_1.ViewWrappedException)) {
            if (!(e instanceof exceptions_1.ExpressionChangedAfterItHasBeenCheckedException)) {
                this.cdState = change_detection_1.ChangeDetectorState.Errored;
            }
            if (lang_1.isPresent(this._currentDebugContext)) {
                throw new exceptions_1.ViewWrappedException(e, stack, this._currentDebugContext);
            }
        }
    };
    AppView.prototype.eventHandler = function (cb) {
        var _this = this;
        if (this.debugMode) {
            return function (event) {
                _this._resetDebug();
                try {
                    return cb(event);
                }
                catch (e) {
                    _this._rethrowWithContext(e, e.stack);
                    throw e;
                }
            };
        }
        else {
            return cb;
        }
    };
    AppView.prototype.throwDestroyedError = function (details) { throw new exceptions_1.ViewDestroyedException(details); };
    return AppView;
}());
exports.AppView = AppView;
function _findLastRenderNode(node) {
    var lastNode;
    if (node instanceof element_1.AppElement) {
        var appEl = node;
        lastNode = appEl.nativeElement;
        if (lang_1.isPresent(appEl.nestedViews)) {
            // Note: Views might have no root nodes at all!
            for (var i = appEl.nestedViews.length - 1; i >= 0; i--) {
                var nestedView = appEl.nestedViews[i];
                if (nestedView.rootNodesOrAppElements.length > 0) {
                    lastNode = _findLastRenderNode(nestedView.rootNodesOrAppElements[nestedView.rootNodesOrAppElements.length - 1]);
                }
            }
        }
    }
    else {
        lastNode = node;
    }
    return lastNode;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlldy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtQkVnb0dMQkgudG1wL2FuZ3VsYXIyL3NyYy9jb3JlL2xpbmtlci92aWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwyQkFPTyxnQ0FBZ0MsQ0FBQyxDQUFBO0FBR3hDLHdCQUF5QixXQUFXLENBQUMsQ0FBQTtBQUNyQyxxQkFZTywwQkFBMEIsQ0FBQyxDQUFBO0FBRWxDLHNCQUFnQywyQkFBMkIsQ0FBQyxDQUFBO0FBRTVELHlCQUF1QixZQUFZLENBQUMsQ0FBQTtBQUVwQywwQkFBdUIsYUFBYSxDQUFDLENBQUE7QUFDckMsMkJBTU8sY0FBYyxDQUFDLENBQUE7QUFDdEIsaUNBTU8scURBQXFELENBQUMsQ0FBQTtBQUM3RCx3QkFBbUQsb0JBQW9CLENBQUMsQ0FBQTtBQUN4RSwyQkFJTyxjQUFjLENBQUMsQ0FBQTtBQUN0Qiw4QkFBZ0QsaUJBQWlCLENBQUMsQ0FBQTtBQUNsRSxpQ0FBOEIsb0JBQW9CLENBQUMsQ0FBQTtBQUVuRCxJQUFJLFlBQVksR0FBZSx3QkFBYyxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFFekU7OztHQUdHO0FBQ0g7SUEyQkUsaUJBQW1CLEtBQVUsRUFBUyxhQUFrQyxFQUFTLElBQWMsRUFDNUUsU0FBb0IsRUFBUyxjQUF3QixFQUNyRCxxQkFBaUMsRUFBUyxNQUErQixFQUN6RSxvQkFBMkM7UUFIM0MsVUFBSyxHQUFMLEtBQUssQ0FBSztRQUFTLGtCQUFhLEdBQWIsYUFBYSxDQUFxQjtRQUFTLFNBQUksR0FBSixJQUFJLENBQVU7UUFDNUUsY0FBUyxHQUFULFNBQVMsQ0FBVztRQUFTLG1CQUFjLEdBQWQsY0FBYyxDQUFVO1FBQ3JELDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBWTtRQUFTLFdBQU0sR0FBTixNQUFNLENBQXlCO1FBQ3pFLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUF4QjlE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QU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRixjQUFDO0FBQUQsQ0FBQyxBQTVVRCxJQTRVQztBQTVVcUIsZUFBTyxVQTRVNUIsQ0FBQTtBQUVELDZCQUE2QixJQUFTO0lBQ3BDLElBQUksUUFBUSxDQUFDO0lBQ2IsRUFBRSxDQUFDLENBQUMsSUFBSSxZQUFZLG9CQUFVLENBQUMsQ0FBQyxDQUFDO1FBQy9CLElBQUksS0FBSyxHQUFlLElBQUksQ0FBQztRQUM3QixRQUFRLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQztRQUMvQixFQUFFLENBQUMsQ0FBQyxnQkFBUyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakMsK0NBQStDO1lBQy9DLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZELElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RDLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakQsUUFBUSxHQUFHLG1CQUFtQixDQUMxQixVQUFVLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2RixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFDTixRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2xCLENBQUM7SUFDRCxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQ2xCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBMaXN0V3JhcHBlcixcbiAgTWFwV3JhcHBlcixcbiAgTWFwLFxuICBTdHJpbmdNYXBXcmFwcGVyLFxuICBpc0xpc3RMaWtlSXRlcmFibGUsXG4gIGFyZUl0ZXJhYmxlc0VxdWFsXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvY29sbGVjdGlvbic7XG5cbmltcG9ydCB7SW5qZWN0b3J9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2RpJztcbmltcG9ydCB7QXBwRWxlbWVudH0gZnJvbSAnLi9lbGVtZW50JztcbmltcG9ydCB7XG4gIGFzc2VydGlvbnNFbmFibGVkLFxuICBpc1ByZXNlbnQsXG4gIGlzQmxhbmssXG4gIFR5cGUsXG4gIGlzQXJyYXksXG4gIGlzTnVtYmVyLFxuICBDT05TVCxcbiAgQ09OU1RfRVhQUixcbiAgc3RyaW5naWZ5LFxuICBpc1ByaW1pdGl2ZSxcbiAgaXNTdHJpbmdcbn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9sYW5nJztcblxuaW1wb3J0IHtPYnNlcnZhYmxlV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9hc3luYyc7XG5pbXBvcnQge1JlbmRlcmVyLCBSb290UmVuZGVyZXIsIFJlbmRlckNvbXBvbmVudFR5cGV9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL3JlbmRlci9hcGknO1xuaW1wb3J0IHtWaWV3UmVmX30gZnJvbSAnLi92aWV3X3JlZic7XG5cbmltcG9ydCB7Vmlld1R5cGV9IGZyb20gJy4vdmlld190eXBlJztcbmltcG9ydCB7XG4gIFZpZXdVdGlscyxcbiAgZmxhdHRlbk5lc3RlZFZpZXdSZW5kZXJOb2RlcyxcbiAgZW5zdXJlU2xvdENvdW50LFxuICBhcnJheUxvb3NlSWRlbnRpY2FsLFxuICBtYXBMb29zZUlkZW50aWNhbFxufSBmcm9tICcuL3ZpZXdfdXRpbHMnO1xuaW1wb3J0IHtcbiAgQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICBDaGFuZ2VEZXRlY3RvclN0YXRlLFxuICBpc0RlZmF1bHRDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgZGV2TW9kZUVxdWFsXG59IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2NoYW5nZV9kZXRlY3Rpb24vY2hhbmdlX2RldGVjdGlvbic7XG5pbXBvcnQge3d0ZkNyZWF0ZVNjb3BlLCB3dGZMZWF2ZSwgV3RmU2NvcGVGbn0gZnJvbSAnLi4vcHJvZmlsZS9wcm9maWxlJztcbmltcG9ydCB7XG4gIEV4cHJlc3Npb25DaGFuZ2VkQWZ0ZXJJdEhhc0JlZW5DaGVja2VkRXhjZXB0aW9uLFxuICBWaWV3RGVzdHJveWVkRXhjZXB0aW9uLFxuICBWaWV3V3JhcHBlZEV4Y2VwdGlvblxufSBmcm9tICcuL2V4Y2VwdGlvbnMnO1xuaW1wb3J0IHtTdGF0aWNOb2RlRGVidWdJbmZvLCBEZWJ1Z0NvbnRleHR9IGZyb20gJy4vZGVidWdfY29udGV4dCc7XG5pbXBvcnQge0VsZW1lbnRJbmplY3Rvcn0gZnJvbSAnLi9lbGVtZW50X2luamVjdG9yJztcblxudmFyIF9zY29wZV9jaGVjazogV3RmU2NvcGVGbiA9IHd0ZkNyZWF0ZVNjb3BlKGBBcHBWaWV3I2NoZWNrKGFzY2lpIGlkKWApO1xuXG4vKipcbiAqIENvc3Qgb2YgbWFraW5nIG9iamVjdHM6IGh0dHA6Ly9qc3BlcmYuY29tL2luc3RhbnRpYXRlLXNpemUtb2Ytb2JqZWN0XG4gKlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQXBwVmlldzxUPiB7XG4gIHJlZjogVmlld1JlZl88VD47XG4gIHJvb3ROb2Rlc09yQXBwRWxlbWVudHM6IGFueVtdO1xuICBhbGxOb2RlczogYW55W107XG4gIGRpc3Bvc2FibGVzOiBGdW5jdGlvbltdO1xuICBzdWJzY3JpcHRpb25zOiBhbnlbXTtcbiAgY29udGVudENoaWxkcmVuOiBBcHBWaWV3PGFueT5bXSA9IFtdO1xuICB2aWV3Q2hpbGRyZW46IEFwcFZpZXc8YW55PltdID0gW107XG4gIHJlbmRlclBhcmVudDogQXBwVmlldzxhbnk+O1xuICB2aWV3Q29udGFpbmVyRWxlbWVudDogQXBwRWxlbWVudCA9IG51bGw7XG5cbiAgLy8gVGhlIG5hbWVzIG9mIHRoZSBiZWxvdyBmaWVsZHMgbXVzdCBiZSBrZXB0IGluIHN5bmMgd2l0aCBjb2RlZ2VuX25hbWVfdXRpbC50cyBvclxuICAvLyBjaGFuZ2UgZGV0ZWN0aW9uIHdpbGwgZmFpbC5cbiAgY2RTdGF0ZTogQ2hhbmdlRGV0ZWN0b3JTdGF0ZSA9IENoYW5nZURldGVjdG9yU3RhdGUuTmV2ZXJDaGVja2VkO1xuXG4gIHByb2plY3RhYmxlTm9kZXM6IEFycmF5PGFueSB8IGFueVtdPjtcblxuICBkZXN0cm95ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICByZW5kZXJlcjogUmVuZGVyZXI7XG5cbiAgcHJpdmF0ZSBfY3VycmVudERlYnVnQ29udGV4dDogRGVidWdDb250ZXh0ID0gbnVsbDtcblxuICBwcml2YXRlIF9oYXNFeHRlcm5hbEhvc3RFbGVtZW50OiBib29sZWFuO1xuXG4gIHB1YmxpYyBjb250ZXh0OiBUO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjbGF6ejogYW55LCBwdWJsaWMgY29tcG9uZW50VHlwZTogUmVuZGVyQ29tcG9uZW50VHlwZSwgcHVibGljIHR5cGU6IFZpZXdUeXBlLFxuICAgICAgICAgICAgICBwdWJsaWMgdmlld1V0aWxzOiBWaWV3VXRpbHMsIHB1YmxpYyBwYXJlbnRJbmplY3RvcjogSW5qZWN0b3IsXG4gICAgICAgICAgICAgIHB1YmxpYyBkZWNsYXJhdGlvbkFwcEVsZW1lbnQ6IEFwcEVsZW1lbnQsIHB1YmxpYyBjZE1vZGU6IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICAgICAgICAgICAgICBwdWJsaWMgc3RhdGljTm9kZURlYnVnSW5mb3M6IFN0YXRpY05vZGVEZWJ1Z0luZm9bXSkge1xuICAgIHRoaXMucmVmID0gbmV3IFZpZXdSZWZfKHRoaXMpO1xuICAgIGlmICh0eXBlID09PSBWaWV3VHlwZS5DT01QT05FTlQgfHwgdHlwZSA9PT0gVmlld1R5cGUuSE9TVCkge1xuICAgICAgdGhpcy5yZW5kZXJlciA9IHZpZXdVdGlscy5yZW5kZXJDb21wb25lbnQoY29tcG9uZW50VHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVuZGVyZXIgPSBkZWNsYXJhdGlvbkFwcEVsZW1lbnQucGFyZW50Vmlldy5yZW5kZXJlcjtcbiAgICB9XG4gIH1cblxuICBjcmVhdGUoY29udGV4dDogVCwgZ2l2ZW5Qcm9qZWN0YWJsZU5vZGVzOiBBcnJheTxhbnkgfCBhbnlbXT4sXG4gICAgICAgICByb290U2VsZWN0b3JPck5vZGU6IHN0cmluZyB8IGFueSk6IEFwcEVsZW1lbnQge1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgdmFyIHByb2plY3RhYmxlTm9kZXM7XG4gICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgIGNhc2UgVmlld1R5cGUuQ09NUE9ORU5UOlxuICAgICAgICBwcm9qZWN0YWJsZU5vZGVzID0gZW5zdXJlU2xvdENvdW50KGdpdmVuUHJvamVjdGFibGVOb2RlcywgdGhpcy5jb21wb25lbnRUeXBlLnNsb3RDb3VudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBWaWV3VHlwZS5FTUJFRERFRDpcbiAgICAgICAgcHJvamVjdGFibGVOb2RlcyA9IHRoaXMuZGVjbGFyYXRpb25BcHBFbGVtZW50LnBhcmVudFZpZXcucHJvamVjdGFibGVOb2RlcztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFZpZXdUeXBlLkhPU1Q6XG4gICAgICAgIC8vIE5vdGU6IERvbid0IGVuc3VyZSB0aGUgc2xvdCBjb3VudCBmb3IgdGhlIHByb2plY3RhYmxlTm9kZXMgYXMgd2Ugc3RvcmVcbiAgICAgICAgLy8gdGhlbSBvbmx5IGZvciB0aGUgY29udGFpbmVkIGNvbXBvbmVudCB2aWV3ICh3aGljaCB3aWxsIGxhdGVyIGNoZWNrIHRoZSBzbG90IGNvdW50Li4uKVxuICAgICAgICBwcm9qZWN0YWJsZU5vZGVzID0gZ2l2ZW5Qcm9qZWN0YWJsZU5vZGVzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgdGhpcy5faGFzRXh0ZXJuYWxIb3N0RWxlbWVudCA9IGlzUHJlc2VudChyb290U2VsZWN0b3JPck5vZGUpO1xuICAgIHRoaXMucHJvamVjdGFibGVOb2RlcyA9IHByb2plY3RhYmxlTm9kZXM7XG4gICAgaWYgKHRoaXMuZGVidWdNb2RlKSB7XG4gICAgICB0aGlzLl9yZXNldERlYnVnKCk7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVJbnRlcm5hbChyb290U2VsZWN0b3JPck5vZGUpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLl9yZXRocm93V2l0aENvbnRleHQoZSwgZS5zdGFjayk7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUludGVybmFsKHJvb3RTZWxlY3Rvck9yTm9kZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE92ZXJ3cml0dGVuIGJ5IGltcGxlbWVudGF0aW9ucy5cbiAgICogUmV0dXJucyB0aGUgQXBwRWxlbWVudCBmb3IgdGhlIGhvc3QgZWxlbWVudCBmb3IgVmlld1R5cGUuSE9TVC5cbiAgICovXG4gIGNyZWF0ZUludGVybmFsKHJvb3RTZWxlY3Rvck9yTm9kZTogc3RyaW5nIHwgYW55KTogQXBwRWxlbWVudCB7IHJldHVybiBudWxsOyB9XG5cbiAgaW5pdChyb290Tm9kZXNPckFwcEVsZW1lbnRzOiBhbnlbXSwgYWxsTm9kZXM6IGFueVtdLCBkaXNwb3NhYmxlczogRnVuY3Rpb25bXSxcbiAgICAgICBzdWJzY3JpcHRpb25zOiBhbnlbXSkge1xuICAgIHRoaXMucm9vdE5vZGVzT3JBcHBFbGVtZW50cyA9IHJvb3ROb2Rlc09yQXBwRWxlbWVudHM7XG4gICAgdGhpcy5hbGxOb2RlcyA9IGFsbE5vZGVzO1xuICAgIHRoaXMuZGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcztcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMgPSBzdWJzY3JpcHRpb25zO1xuICAgIGlmICh0aGlzLnR5cGUgPT09IFZpZXdUeXBlLkNPTVBPTkVOVCkge1xuICAgICAgLy8gTm90ZTogdGhlIHJlbmRlciBub2RlcyBoYXZlIGJlZW4gYXR0YWNoZWQgdG8gdGhlaXIgaG9zdCBlbGVtZW50XG4gICAgICAvLyBpbiB0aGUgVmlld0ZhY3RvcnkgYWxyZWFkeS5cbiAgICAgIHRoaXMuZGVjbGFyYXRpb25BcHBFbGVtZW50LnBhcmVudFZpZXcudmlld0NoaWxkcmVuLnB1c2godGhpcyk7XG4gICAgICB0aGlzLnJlbmRlclBhcmVudCA9IHRoaXMuZGVjbGFyYXRpb25BcHBFbGVtZW50LnBhcmVudFZpZXc7XG4gICAgICB0aGlzLmRpcnR5UGFyZW50UXVlcmllc0ludGVybmFsKCk7XG4gICAgfVxuICB9XG5cbiAgc2VsZWN0T3JDcmVhdGVIb3N0RWxlbWVudChlbGVtZW50TmFtZTogc3RyaW5nLCByb290U2VsZWN0b3JPck5vZGU6IHN0cmluZyB8IGFueSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWJ1Z0N0eDogRGVidWdDb250ZXh0KTogYW55IHtcbiAgICB2YXIgaG9zdEVsZW1lbnQ7XG4gICAgaWYgKGlzUHJlc2VudChyb290U2VsZWN0b3JPck5vZGUpKSB7XG4gICAgICBob3N0RWxlbWVudCA9IHRoaXMucmVuZGVyZXIuc2VsZWN0Um9vdEVsZW1lbnQocm9vdFNlbGVjdG9yT3JOb2RlLCBkZWJ1Z0N0eCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhvc3RFbGVtZW50ID0gdGhpcy5yZW5kZXJlci5jcmVhdGVFbGVtZW50KG51bGwsIGVsZW1lbnROYW1lLCBkZWJ1Z0N0eCk7XG4gICAgfVxuICAgIHJldHVybiBob3N0RWxlbWVudDtcbiAgfVxuXG4gIGluamVjdG9yR2V0KHRva2VuOiBhbnksIG5vZGVJbmRleDogbnVtYmVyLCBub3RGb3VuZFJlc3VsdDogYW55KTogYW55IHtcbiAgICBpZiAodGhpcy5kZWJ1Z01vZGUpIHtcbiAgICAgIHRoaXMuX3Jlc2V0RGVidWcoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluamVjdG9yR2V0SW50ZXJuYWwodG9rZW4sIG5vZGVJbmRleCwgbm90Rm91bmRSZXN1bHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLl9yZXRocm93V2l0aENvbnRleHQoZSwgZS5zdGFjayk7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLmluamVjdG9yR2V0SW50ZXJuYWwodG9rZW4sIG5vZGVJbmRleCwgbm90Rm91bmRSZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBPdmVyd3JpdHRlbiBieSBpbXBsZW1lbnRhdGlvbnNcbiAgICovXG4gIGluamVjdG9yR2V0SW50ZXJuYWwodG9rZW46IGFueSwgbm9kZUluZGV4OiBudW1iZXIsIG5vdEZvdW5kUmVzdWx0OiBhbnkpOiBhbnkge1xuICAgIHJldHVybiBub3RGb3VuZFJlc3VsdDtcbiAgfVxuXG4gIGluamVjdG9yKG5vZGVJbmRleDogbnVtYmVyKTogSW5qZWN0b3Ige1xuICAgIGlmIChpc1ByZXNlbnQobm9kZUluZGV4KSkge1xuICAgICAgcmV0dXJuIG5ldyBFbGVtZW50SW5qZWN0b3IodGhpcywgbm9kZUluZGV4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMucGFyZW50SW5qZWN0b3I7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5faGFzRXh0ZXJuYWxIb3N0RWxlbWVudCkge1xuICAgICAgdGhpcy5yZW5kZXJlci5kZXRhY2hWaWV3KHRoaXMuZmxhdFJvb3ROb2Rlcyk7XG4gICAgfSBlbHNlIGlmIChpc1ByZXNlbnQodGhpcy52aWV3Q29udGFpbmVyRWxlbWVudCkpIHtcbiAgICAgIHRoaXMudmlld0NvbnRhaW5lckVsZW1lbnQuZGV0YWNoVmlldyh0aGlzLnZpZXdDb250YWluZXJFbGVtZW50Lm5lc3RlZFZpZXdzLmluZGV4T2YodGhpcykpO1xuICAgIH1cbiAgICB0aGlzLl9kZXN0cm95UmVjdXJzZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZGVzdHJveVJlY3Vyc2UoKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuY29udGVudENoaWxkcmVuO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkcmVuW2ldLl9kZXN0cm95UmVjdXJzZSgpO1xuICAgIH1cbiAgICBjaGlsZHJlbiA9IHRoaXMudmlld0NoaWxkcmVuO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoaWxkcmVuW2ldLl9kZXN0cm95UmVjdXJzZSgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5kZWJ1Z01vZGUpIHtcbiAgICAgIHRoaXMuX3Jlc2V0RGVidWcoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lMb2NhbCgpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLl9yZXRocm93V2l0aENvbnRleHQoZSwgZS5zdGFjayk7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2Rlc3Ryb3lMb2NhbCgpO1xuICAgIH1cblxuICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX2Rlc3Ryb3lMb2NhbCgpIHtcbiAgICB2YXIgaG9zdEVsZW1lbnQgPVxuICAgICAgICB0aGlzLnR5cGUgPT09IFZpZXdUeXBlLkNPTVBPTkVOVCA/IHRoaXMuZGVjbGFyYXRpb25BcHBFbGVtZW50Lm5hdGl2ZUVsZW1lbnQgOiBudWxsO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kaXNwb3NhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5kaXNwb3NhYmxlc1tpXSgpO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuc3Vic2NyaXB0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgT2JzZXJ2YWJsZVdyYXBwZXIuZGlzcG9zZSh0aGlzLnN1YnNjcmlwdGlvbnNbaV0pO1xuICAgIH1cbiAgICB0aGlzLmRlc3Ryb3lJbnRlcm5hbCgpO1xuICAgIGlmICh0aGlzLl9oYXNFeHRlcm5hbEhvc3RFbGVtZW50KSB7XG4gICAgICB0aGlzLnJlbmRlcmVyLmRldGFjaFZpZXcodGhpcy5mbGF0Um9vdE5vZGVzKTtcbiAgICB9IGVsc2UgaWYgKGlzUHJlc2VudCh0aGlzLnZpZXdDb250YWluZXJFbGVtZW50KSkge1xuICAgICAgdGhpcy52aWV3Q29udGFpbmVyRWxlbWVudC5kZXRhY2hWaWV3KHRoaXMudmlld0NvbnRhaW5lckVsZW1lbnQubmVzdGVkVmlld3MuaW5kZXhPZih0aGlzKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlydHlQYXJlbnRRdWVyaWVzSW50ZXJuYWwoKTtcbiAgICB9XG4gICAgdGhpcy5yZW5kZXJlci5kZXN0cm95Vmlldyhob3N0RWxlbWVudCwgdGhpcy5hbGxOb2Rlcyk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcndyaXR0ZW4gYnkgaW1wbGVtZW50YXRpb25zXG4gICAqL1xuICBkZXN0cm95SW50ZXJuYWwoKTogdm9pZCB7fVxuXG4gIGdldCBkZWJ1Z01vZGUoKTogYm9vbGVhbiB7IHJldHVybiBpc1ByZXNlbnQodGhpcy5zdGF0aWNOb2RlRGVidWdJbmZvcyk7IH1cblxuICBnZXQgY2hhbmdlRGV0ZWN0b3JSZWYoKTogQ2hhbmdlRGV0ZWN0b3JSZWYgeyByZXR1cm4gdGhpcy5yZWY7IH1cblxuICBnZXQgcGFyZW50KCk6IEFwcFZpZXc8YW55PiB7XG4gICAgcmV0dXJuIGlzUHJlc2VudCh0aGlzLmRlY2xhcmF0aW9uQXBwRWxlbWVudCkgPyB0aGlzLmRlY2xhcmF0aW9uQXBwRWxlbWVudC5wYXJlbnRWaWV3IDogbnVsbDtcbiAgfVxuXG4gIGdldCBmbGF0Um9vdE5vZGVzKCk6IGFueVtdIHsgcmV0dXJuIGZsYXR0ZW5OZXN0ZWRWaWV3UmVuZGVyTm9kZXModGhpcy5yb290Tm9kZXNPckFwcEVsZW1lbnRzKTsgfVxuXG4gIGdldCBsYXN0Um9vdE5vZGUoKTogYW55IHtcbiAgICB2YXIgbGFzdE5vZGUgPSB0aGlzLnJvb3ROb2Rlc09yQXBwRWxlbWVudHMubGVuZ3RoID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMucm9vdE5vZGVzT3JBcHBFbGVtZW50c1t0aGlzLnJvb3ROb2Rlc09yQXBwRWxlbWVudHMubGVuZ3RoIC0gMV0gOlxuICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuICAgIHJldHVybiBfZmluZExhc3RSZW5kZXJOb2RlKGxhc3ROb2RlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBPdmVyd3JpdHRlbiBieSBpbXBsZW1lbnRhdGlvbnNcbiAgICovXG4gIGRpcnR5UGFyZW50UXVlcmllc0ludGVybmFsKCk6IHZvaWQge31cblxuICBhZGRSZW5kZXJDb250ZW50Q2hpbGQodmlldzogQXBwVmlldzxhbnk+KTogdm9pZCB7XG4gICAgdGhpcy5jb250ZW50Q2hpbGRyZW4ucHVzaCh2aWV3KTtcbiAgICB2aWV3LnJlbmRlclBhcmVudCA9IHRoaXM7XG4gICAgdmlldy5kaXJ0eVBhcmVudFF1ZXJpZXNJbnRlcm5hbCgpO1xuICB9XG5cbiAgcmVtb3ZlQ29udGVudENoaWxkKHZpZXc6IEFwcFZpZXc8YW55Pik6IHZvaWQge1xuICAgIExpc3RXcmFwcGVyLnJlbW92ZSh0aGlzLmNvbnRlbnRDaGlsZHJlbiwgdmlldyk7XG4gICAgdmlldy5kaXJ0eVBhcmVudFF1ZXJpZXNJbnRlcm5hbCgpO1xuICAgIHZpZXcucmVuZGVyUGFyZW50ID0gbnVsbDtcbiAgfVxuXG4gIGRldGVjdENoYW5nZXModGhyb3dPbkNoYW5nZTogYm9vbGVhbik6IHZvaWQge1xuICAgIHZhciBzID0gX3Njb3BlX2NoZWNrKHRoaXMuY2xhenopO1xuICAgIGlmICh0aGlzLmNkTW9kZSA9PT0gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGV0YWNoZWQgfHxcbiAgICAgICAgdGhpcy5jZE1vZGUgPT09IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkNoZWNrZWQgfHxcbiAgICAgICAgdGhpcy5jZFN0YXRlID09PSBDaGFuZ2VEZXRlY3RvclN0YXRlLkVycm9yZWQpXG4gICAgICByZXR1cm47XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSB7XG4gICAgICB0aGlzLnRocm93RGVzdHJveWVkRXJyb3IoJ2RldGVjdENoYW5nZXMnKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGVidWdNb2RlKSB7XG4gICAgICB0aGlzLl9yZXNldERlYnVnKCk7XG4gICAgICB0cnkge1xuICAgICAgICB0aGlzLmRldGVjdENoYW5nZXNJbnRlcm5hbCh0aHJvd09uQ2hhbmdlKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhpcy5fcmV0aHJvd1dpdGhDb250ZXh0KGUsIGUuc3RhY2spO1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRldGVjdENoYW5nZXNJbnRlcm5hbCh0aHJvd09uQ2hhbmdlKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuY2RNb2RlID09PSBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5DaGVja09uY2UpXG4gICAgICB0aGlzLmNkTW9kZSA9IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkNoZWNrZWQ7XG5cbiAgICB0aGlzLmNkU3RhdGUgPSBDaGFuZ2VEZXRlY3RvclN0YXRlLkNoZWNrZWRCZWZvcmU7XG4gICAgd3RmTGVhdmUocyk7XG4gIH1cblxuICAvKipcbiAgICogT3ZlcndyaXR0ZW4gYnkgaW1wbGVtZW50YXRpb25zXG4gICAqL1xuICBkZXRlY3RDaGFuZ2VzSW50ZXJuYWwodGhyb3dPbkNoYW5nZTogYm9vbGVhbik6IHZvaWQge1xuICAgIHRoaXMuZGV0ZWN0Q29udGVudENoaWxkcmVuQ2hhbmdlcyh0aHJvd09uQ2hhbmdlKTtcbiAgICB0aGlzLmRldGVjdFZpZXdDaGlsZHJlbkNoYW5nZXModGhyb3dPbkNoYW5nZSk7XG4gIH1cblxuICBkZXRlY3RDb250ZW50Q2hpbGRyZW5DaGFuZ2VzKHRocm93T25DaGFuZ2U6IGJvb2xlYW4pIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY29udGVudENoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICB0aGlzLmNvbnRlbnRDaGlsZHJlbltpXS5kZXRlY3RDaGFuZ2VzKHRocm93T25DaGFuZ2UpO1xuICAgIH1cbiAgfVxuXG4gIGRldGVjdFZpZXdDaGlsZHJlbkNoYW5nZXModGhyb3dPbkNoYW5nZTogYm9vbGVhbikge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy52aWV3Q2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIHRoaXMudmlld0NoaWxkcmVuW2ldLmRldGVjdENoYW5nZXModGhyb3dPbkNoYW5nZSk7XG4gICAgfVxuICB9XG5cbiAgYWRkVG9Db250ZW50Q2hpbGRyZW4ocmVuZGVyQXBwRWxlbWVudDogQXBwRWxlbWVudCk6IHZvaWQge1xuICAgIHJlbmRlckFwcEVsZW1lbnQucGFyZW50Vmlldy5jb250ZW50Q2hpbGRyZW4ucHVzaCh0aGlzKTtcbiAgICB0aGlzLnZpZXdDb250YWluZXJFbGVtZW50ID0gcmVuZGVyQXBwRWxlbWVudDtcbiAgICB0aGlzLmRpcnR5UGFyZW50UXVlcmllc0ludGVybmFsKCk7XG4gIH1cblxuICByZW1vdmVGcm9tQ29udGVudENoaWxkcmVuKHJlbmRlckFwcEVsZW1lbnQ6IEFwcEVsZW1lbnQpOiB2b2lkIHtcbiAgICBMaXN0V3JhcHBlci5yZW1vdmUocmVuZGVyQXBwRWxlbWVudC5wYXJlbnRWaWV3LmNvbnRlbnRDaGlsZHJlbiwgdGhpcyk7XG4gICAgdGhpcy5kaXJ0eVBhcmVudFF1ZXJpZXNJbnRlcm5hbCgpO1xuICAgIHRoaXMudmlld0NvbnRhaW5lckVsZW1lbnQgPSBudWxsO1xuICB9XG5cbiAgbWFya0FzQ2hlY2tPbmNlKCk6IHZvaWQgeyB0aGlzLmNkTW9kZSA9IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkNoZWNrT25jZTsgfVxuXG4gIG1hcmtQYXRoVG9Sb290QXNDaGVja09uY2UoKTogdm9pZCB7XG4gICAgdmFyIGM6IEFwcFZpZXc8YW55PiA9IHRoaXM7XG4gICAgd2hpbGUgKGlzUHJlc2VudChjKSAmJiBjLmNkTW9kZSAhPT0gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuRGV0YWNoZWQpIHtcbiAgICAgIGlmIChjLmNkTW9kZSA9PT0gQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuQ2hlY2tlZCkge1xuICAgICAgICBjLmNkTW9kZSA9IENoYW5nZURldGVjdGlvblN0cmF0ZWd5LkNoZWNrT25jZTtcbiAgICAgIH1cbiAgICAgIGMgPSBjLnJlbmRlclBhcmVudDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9yZXNldERlYnVnKCkgeyB0aGlzLl9jdXJyZW50RGVidWdDb250ZXh0ID0gbnVsbDsgfVxuXG4gIGRlYnVnKG5vZGVJbmRleDogbnVtYmVyLCByb3dOdW06IG51bWJlciwgY29sTnVtOiBudW1iZXIpOiBEZWJ1Z0NvbnRleHQge1xuICAgIHJldHVybiB0aGlzLl9jdXJyZW50RGVidWdDb250ZXh0ID0gbmV3IERlYnVnQ29udGV4dCh0aGlzLCBub2RlSW5kZXgsIHJvd051bSwgY29sTnVtKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JldGhyb3dXaXRoQ29udGV4dChlOiBhbnksIHN0YWNrOiBhbnkpIHtcbiAgICBpZiAoIShlIGluc3RhbmNlb2YgVmlld1dyYXBwZWRFeGNlcHRpb24pKSB7XG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgRXhwcmVzc2lvbkNoYW5nZWRBZnRlckl0SGFzQmVlbkNoZWNrZWRFeGNlcHRpb24pKSB7XG4gICAgICAgIHRoaXMuY2RTdGF0ZSA9IENoYW5nZURldGVjdG9yU3RhdGUuRXJyb3JlZDtcbiAgICAgIH1cbiAgICAgIGlmIChpc1ByZXNlbnQodGhpcy5fY3VycmVudERlYnVnQ29udGV4dCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFZpZXdXcmFwcGVkRXhjZXB0aW9uKGUsIHN0YWNrLCB0aGlzLl9jdXJyZW50RGVidWdDb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBldmVudEhhbmRsZXIoY2I6IEZ1bmN0aW9uKTogRnVuY3Rpb24ge1xuICAgIGlmICh0aGlzLmRlYnVnTW9kZSkge1xuICAgICAgcmV0dXJuIChldmVudCkgPT4ge1xuICAgICAgICB0aGlzLl9yZXNldERlYnVnKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIGNiKGV2ZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHRoaXMuX3JldGhyb3dXaXRoQ29udGV4dChlLCBlLnN0YWNrKTtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY2I7XG4gICAgfVxuICB9XG5cbiAgdGhyb3dEZXN0cm95ZWRFcnJvcihkZXRhaWxzOiBzdHJpbmcpOiB2b2lkIHsgdGhyb3cgbmV3IFZpZXdEZXN0cm95ZWRFeGNlcHRpb24oZGV0YWlscyk7IH1cbn1cblxuZnVuY3Rpb24gX2ZpbmRMYXN0UmVuZGVyTm9kZShub2RlOiBhbnkpOiBhbnkge1xuICB2YXIgbGFzdE5vZGU7XG4gIGlmIChub2RlIGluc3RhbmNlb2YgQXBwRWxlbWVudCkge1xuICAgIHZhciBhcHBFbCA9IDxBcHBFbGVtZW50Pm5vZGU7XG4gICAgbGFzdE5vZGUgPSBhcHBFbC5uYXRpdmVFbGVtZW50O1xuICAgIGlmIChpc1ByZXNlbnQoYXBwRWwubmVzdGVkVmlld3MpKSB7XG4gICAgICAvLyBOb3RlOiBWaWV3cyBtaWdodCBoYXZlIG5vIHJvb3Qgbm9kZXMgYXQgYWxsIVxuICAgICAgZm9yICh2YXIgaSA9IGFwcEVsLm5lc3RlZFZpZXdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIHZhciBuZXN0ZWRWaWV3ID0gYXBwRWwubmVzdGVkVmlld3NbaV07XG4gICAgICAgIGlmIChuZXN0ZWRWaWV3LnJvb3ROb2Rlc09yQXBwRWxlbWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGxhc3ROb2RlID0gX2ZpbmRMYXN0UmVuZGVyTm9kZShcbiAgICAgICAgICAgICAgbmVzdGVkVmlldy5yb290Tm9kZXNPckFwcEVsZW1lbnRzW25lc3RlZFZpZXcucm9vdE5vZGVzT3JBcHBFbGVtZW50cy5sZW5ndGggLSAxXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgbGFzdE5vZGUgPSBub2RlO1xuICB9XG4gIHJldHVybiBsYXN0Tm9kZTtcbn1cbiJdfQ==