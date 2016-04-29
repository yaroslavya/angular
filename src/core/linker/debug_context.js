'use strict';"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var lang_1 = require('angular2/src/facade/lang');
var collection_1 = require('angular2/src/facade/collection');
var view_type_1 = require('./view_type');
var StaticNodeDebugInfo = (function () {
    function StaticNodeDebugInfo(providerTokens, componentToken, refTokens) {
        this.providerTokens = providerTokens;
        this.componentToken = componentToken;
        this.refTokens = refTokens;
    }
    StaticNodeDebugInfo = __decorate([
        lang_1.CONST(), 
        __metadata('design:paramtypes', [Array, Object, Object])
    ], StaticNodeDebugInfo);
    return StaticNodeDebugInfo;
}());
exports.StaticNodeDebugInfo = StaticNodeDebugInfo;
var DebugContext = (function () {
    function DebugContext(_view, _nodeIndex, _tplRow, _tplCol) {
        this._view = _view;
        this._nodeIndex = _nodeIndex;
        this._tplRow = _tplRow;
        this._tplCol = _tplCol;
    }
    Object.defineProperty(DebugContext.prototype, "_staticNodeInfo", {
        get: function () {
            return lang_1.isPresent(this._nodeIndex) ? this._view.staticNodeDebugInfos[this._nodeIndex] : null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "context", {
        get: function () { return this._view.context; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "component", {
        get: function () {
            var staticNodeInfo = this._staticNodeInfo;
            if (lang_1.isPresent(staticNodeInfo) && lang_1.isPresent(staticNodeInfo.componentToken)) {
                return this.injector.get(staticNodeInfo.componentToken);
            }
            return null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "componentRenderElement", {
        get: function () {
            var componentView = this._view;
            while (lang_1.isPresent(componentView.declarationAppElement) &&
                componentView.type !== view_type_1.ViewType.COMPONENT) {
                componentView = componentView.declarationAppElement.parentView;
            }
            return lang_1.isPresent(componentView.declarationAppElement) ?
                componentView.declarationAppElement.nativeElement :
                null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "injector", {
        get: function () { return this._view.injector(this._nodeIndex); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "renderNode", {
        get: function () {
            if (lang_1.isPresent(this._nodeIndex) && lang_1.isPresent(this._view.allNodes)) {
                return this._view.allNodes[this._nodeIndex];
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "providerTokens", {
        get: function () {
            var staticNodeInfo = this._staticNodeInfo;
            return lang_1.isPresent(staticNodeInfo) ? staticNodeInfo.providerTokens : null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "source", {
        get: function () {
            return this._view.componentType.templateUrl + ":" + this._tplRow + ":" + this._tplCol;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(DebugContext.prototype, "references", {
        get: function () {
            var _this = this;
            var varValues = {};
            var staticNodeInfo = this._staticNodeInfo;
            if (lang_1.isPresent(staticNodeInfo)) {
                var refs = staticNodeInfo.refTokens;
                collection_1.StringMapWrapper.forEach(refs, function (refToken, refName) {
                    var varValue;
                    if (lang_1.isBlank(refToken)) {
                        varValue = lang_1.isPresent(_this._view.allNodes) ? _this._view.allNodes[_this._nodeIndex] : null;
                    }
                    else {
                        varValue = _this._view.injectorGet(refToken, _this._nodeIndex, null);
                    }
                    varValues[refName] = varValue;
                });
            }
            return varValues;
        },
        enumerable: true,
        configurable: true
    });
    return DebugContext;
}());
exports.DebugContext = DebugContext;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdfY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtbUxVbGQxczQudG1wL2FuZ3VsYXIyL3NyYy9jb3JlL2xpbmtlci9kZWJ1Z19jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxxQkFBd0MsMEJBQTBCLENBQUMsQ0FBQTtBQUNuRSwyQkFBNEMsZ0NBQWdDLENBQUMsQ0FBQTtBQUk3RSwwQkFBdUIsYUFBYSxDQUFDLENBQUE7QUFHckM7SUFDRSw2QkFBbUIsY0FBcUIsRUFBUyxjQUFtQixFQUNqRCxTQUErQjtRQUQvQixtQkFBYyxHQUFkLGNBQWMsQ0FBTztRQUFTLG1CQUFjLEdBQWQsY0FBYyxDQUFLO1FBQ2pELGNBQVMsR0FBVCxTQUFTLENBQXNCO0lBQUcsQ0FBQztJQUh4RDtRQUFDLFlBQUssRUFBRTs7MkJBQUE7SUFJUiwwQkFBQztBQUFELENBQUMsQUFIRCxJQUdDO0FBSFksMkJBQW1CLHNCQUcvQixDQUFBO0FBRUQ7SUFDRSxzQkFBb0IsS0FBbUIsRUFBVSxVQUFrQixFQUFVLE9BQWUsRUFDeEUsT0FBZTtRQURmLFVBQUssR0FBTCxLQUFLLENBQWM7UUFBVSxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQVUsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUN4RSxZQUFPLEdBQVAsT0FBTyxDQUFRO0lBQUcsQ0FBQztJQUV2QyxzQkFBWSx5Q0FBZTthQUEzQjtZQUNFLE1BQU0sQ0FBQyxnQkFBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDOUYsQ0FBQzs7O09BQUE7SUFFRCxzQkFBSSxpQ0FBTzthQUFYLGNBQWdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENB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b0JBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ04sUUFBUSxHQUFHLEtBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUNyRSxDQUFDO29CQUNELFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUM7Z0JBQ2hDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztZQUNELE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDbkIsQ0FBQzs7O09BQUE7SUFDSCxtQkFBQztBQUFELENBQUMsQUExREQsSUEwREM7QUExRFksb0JBQVksZUEwRHhCLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2lzUHJlc2VudCwgaXNCbGFuaywgQ09OU1R9IGZyb20gJ2FuZ3VsYXIyL3NyYy9mYWNhZGUvbGFuZyc7XG5pbXBvcnQge0xpc3RXcmFwcGVyLCBTdHJpbmdNYXBXcmFwcGVyfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2NvbGxlY3Rpb24nO1xuaW1wb3J0IHtJbmplY3Rvcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvZGknO1xuaW1wb3J0IHtSZW5kZXJEZWJ1Z0luZm99IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL3JlbmRlci9hcGknO1xuaW1wb3J0IHtBcHBWaWV3fSBmcm9tICcuL3ZpZXcnO1xuaW1wb3J0IHtWaWV3VHlwZX0gZnJvbSAnLi92aWV3X3R5cGUnO1xuXG5AQ09OU1QoKVxuZXhwb3J0IGNsYXNzIFN0YXRpY05vZGVEZWJ1Z0luZm8ge1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcHJvdmlkZXJUb2tlbnM6IGFueVtdLCBwdWJsaWMgY29tcG9uZW50VG9rZW46IGFueSxcbiAgICAgICAgICAgICAgcHVibGljIHJlZlRva2Vuczoge1trZXk6IHN0cmluZ106IGFueX0pIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z0NvbnRleHQgaW1wbGVtZW50cyBSZW5kZXJEZWJ1Z0luZm8ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF92aWV3OiBBcHBWaWV3PGFueT4sIHByaXZhdGUgX25vZGVJbmRleDogbnVtYmVyLCBwcml2YXRlIF90cGxSb3c6IG51bWJlcixcbiAgICAgICAgICAgICAgcHJpdmF0ZSBfdHBsQ29sOiBudW1iZXIpIHt9XG5cbiAgcHJpdmF0ZSBnZXQgX3N0YXRpY05vZGVJbmZvKCk6IFN0YXRpY05vZGVEZWJ1Z0luZm8ge1xuICAgIHJldHVybiBpc1ByZXNlbnQodGhpcy5fbm9kZUluZGV4KSA/IHRoaXMuX3ZpZXcuc3RhdGljTm9kZURlYnVnSW5mb3NbdGhpcy5fbm9kZUluZGV4XSA6IG51bGw7XG4gIH1cblxuICBnZXQgY29udGV4dCgpIHsgcmV0dXJuIHRoaXMuX3ZpZXcuY29udGV4dDsgfVxuICBnZXQgY29tcG9uZW50KCkge1xuICAgIHZhciBzdGF0aWNOb2RlSW5mbyA9IHRoaXMuX3N0YXRpY05vZGVJbmZvO1xuICAgIGlmIChpc1ByZXNlbnQoc3RhdGljTm9kZUluZm8pICYmIGlzUHJlc2VudChzdGF0aWNOb2RlSW5mby5jb21wb25lbnRUb2tlbikpIHtcbiAgICAgIHJldHVybiB0aGlzLmluamVjdG9yLmdldChzdGF0aWNOb2RlSW5mby5jb21wb25lbnRUb2tlbik7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGdldCBjb21wb25lbnRSZW5kZXJFbGVtZW50KCkge1xuICAgIHZhciBjb21wb25lbnRWaWV3ID0gdGhpcy5fdmlldztcbiAgICB3aGlsZSAoaXNQcmVzZW50KGNvbXBvbmVudFZpZXcuZGVjbGFyYXRpb25BcHBFbGVtZW50KSAmJlxuICAgICAgICAgICBjb21wb25lbnRWaWV3LnR5cGUgIT09IFZpZXdUeXBlLkNPTVBPTkVOVCkge1xuICAgICAgY29tcG9uZW50VmlldyA9IGNvbXBvbmVudFZpZXcuZGVjbGFyYXRpb25BcHBFbGVtZW50LnBhcmVudFZpZXc7XG4gICAgfVxuICAgIHJldHVybiBpc1ByZXNlbnQoY29tcG9uZW50Vmlldy5kZWNsYXJhdGlvbkFwcEVsZW1lbnQpID9cbiAgICAgICAgICAgICAgIGNvbXBvbmVudFZpZXcuZGVjbGFyYXRpb25BcHBFbGVtZW50Lm5hdGl2ZUVsZW1lbnQgOlxuICAgICAgICAgICAgICAgbnVsbDtcbiAgfVxuICBnZXQgaW5qZWN0b3IoKTogSW5qZWN0b3IgeyByZXR1cm4gdGhpcy5fdmlldy5pbmplY3Rvcih0aGlzLl9ub2RlSW5kZXgpOyB9XG4gIGdldCByZW5kZXJOb2RlKCk6IGFueSB7XG4gICAgaWYgKGlzUHJlc2VudCh0aGlzLl9ub2RlSW5kZXgpICYmIGlzUHJlc2VudCh0aGlzLl92aWV3LmFsbE5vZGVzKSkge1xuICAgICAgcmV0dXJuIHRoaXMuX3ZpZXcuYWxsTm9kZXNbdGhpcy5fbm9kZUluZGV4XTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIGdldCBwcm92aWRlclRva2VucygpOiBhbnlbXSB7XG4gICAgdmFyIHN0YXRpY05vZGVJbmZvID0gdGhpcy5fc3RhdGljTm9kZUluZm87XG4gICAgcmV0dXJuIGlzUHJlc2VudChzdGF0aWNOb2RlSW5mbykgPyBzdGF0aWNOb2RlSW5mby5wcm92aWRlclRva2VucyA6IG51bGw7XG4gIH1cbiAgZ2V0IHNvdXJjZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0aGlzLl92aWV3LmNvbXBvbmVudFR5cGUudGVtcGxhdGVVcmx9OiR7dGhpcy5fdHBsUm93fToke3RoaXMuX3RwbENvbH1gO1xuICB9XG4gIGdldCByZWZlcmVuY2VzKCk6IHtba2V5OiBzdHJpbmddOiBhbnl9IHtcbiAgICB2YXIgdmFyVmFsdWVzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSA9IHt9O1xuICAgIHZhciBzdGF0aWNOb2RlSW5mbyA9IHRoaXMuX3N0YXRpY05vZGVJbmZvO1xuICAgIGlmIChpc1ByZXNlbnQoc3RhdGljTm9kZUluZm8pKSB7XG4gICAgICB2YXIgcmVmcyA9IHN0YXRpY05vZGVJbmZvLnJlZlRva2VucztcbiAgICAgIFN0cmluZ01hcFdyYXBwZXIuZm9yRWFjaChyZWZzLCAocmVmVG9rZW4sIHJlZk5hbWUpID0+IHtcbiAgICAgICAgdmFyIHZhclZhbHVlO1xuICAgICAgICBpZiAoaXNCbGFuayhyZWZUb2tlbikpIHtcbiAgICAgICAgICB2YXJWYWx1ZSA9IGlzUHJlc2VudCh0aGlzLl92aWV3LmFsbE5vZGVzKSA/IHRoaXMuX3ZpZXcuYWxsTm9kZXNbdGhpcy5fbm9kZUluZGV4XSA6IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyVmFsdWUgPSB0aGlzLl92aWV3LmluamVjdG9yR2V0KHJlZlRva2VuLCB0aGlzLl9ub2RlSW5kZXgsIG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHZhclZhbHVlc1tyZWZOYW1lXSA9IHZhclZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB2YXJWYWx1ZXM7XG4gIH1cbn1cbiJdfQ==