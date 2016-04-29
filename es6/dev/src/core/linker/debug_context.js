var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { isPresent, isBlank, CONST } from 'angular2/src/facade/lang';
import { StringMapWrapper } from 'angular2/src/facade/collection';
import { ViewType } from './view_type';
export let StaticNodeDebugInfo = class StaticNodeDebugInfo {
    constructor(providerTokens, componentToken, refTokens) {
        this.providerTokens = providerTokens;
        this.componentToken = componentToken;
        this.refTokens = refTokens;
    }
};
StaticNodeDebugInfo = __decorate([
    CONST(), 
    __metadata('design:paramtypes', [Array, Object, Object])
], StaticNodeDebugInfo);
export class DebugContext {
    constructor(_view, _nodeIndex, _tplRow, _tplCol) {
        this._view = _view;
        this._nodeIndex = _nodeIndex;
        this._tplRow = _tplRow;
        this._tplCol = _tplCol;
    }
    get _staticNodeInfo() {
        return isPresent(this._nodeIndex) ? this._view.staticNodeDebugInfos[this._nodeIndex] : null;
    }
    get context() { return this._view.context; }
    get component() {
        var staticNodeInfo = this._staticNodeInfo;
        if (isPresent(staticNodeInfo) && isPresent(staticNodeInfo.componentToken)) {
            return this.injector.get(staticNodeInfo.componentToken);
        }
        return null;
    }
    get componentRenderElement() {
        var componentView = this._view;
        while (isPresent(componentView.declarationAppElement) &&
            componentView.type !== ViewType.COMPONENT) {
            componentView = componentView.declarationAppElement.parentView;
        }
        return isPresent(componentView.declarationAppElement) ?
            componentView.declarationAppElement.nativeElement :
            null;
    }
    get injector() { return this._view.injector(this._nodeIndex); }
    get renderNode() {
        if (isPresent(this._nodeIndex) && isPresent(this._view.allNodes)) {
            return this._view.allNodes[this._nodeIndex];
        }
        else {
            return null;
        }
    }
    get providerTokens() {
        var staticNodeInfo = this._staticNodeInfo;
        return isPresent(staticNodeInfo) ? staticNodeInfo.providerTokens : null;
    }
    get source() {
        return `${this._view.componentType.templateUrl}:${this._tplRow}:${this._tplCol}`;
    }
    get references() {
        var varValues = {};
        var staticNodeInfo = this._staticNodeInfo;
        if (isPresent(staticNodeInfo)) {
            var refs = staticNodeInfo.refTokens;
            StringMapWrapper.forEach(refs, (refToken, refName) => {
                var varValue;
                if (isBlank(refToken)) {
                    varValue = isPresent(this._view.allNodes) ? this._view.allNodes[this._nodeIndex] : null;
                }
                else {
                    varValue = this._view.injectorGet(refToken, this._nodeIndex, null);
                }
                varValues[refName] = varValue;
            });
        }
        return varValues;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdfY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtNVgzakRmb2QudG1wL2FuZ3VsYXIyL3NyYy9jb3JlL2xpbmtlci9kZWJ1Z19jb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztPQUFPLEVBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUMsTUFBTSwwQkFBMEI7T0FDM0QsRUFBYyxnQkFBZ0IsRUFBQyxNQUFNLGdDQUFnQztPQUlyRSxFQUFDLFFBQVEsRUFBQyxNQUFNLGFBQWE7QUFHcEM7SUFDRSxZQUFtQixjQUFxQixFQUFTLGNBQW1CLEVBQ2pELFNBQStCO1FBRC9CLG1CQUFjLEdBQWQsY0FBYyxDQUFPO1FBQVMsbUJBQWMsR0FBZCxjQUFjLENBQUs7UUFDakQsY0FBUyxHQUFULFNBQVMsQ0FBc0I7SUFBRyxDQUFDO0FBQ3hELENBQUM7QUFKRDtJQUFDLEtBQUssRUFBRTs7dUJBQUE7QUFNUjtJQUNFLFlBQW9CLEtBQW1CLEVBQVUsVUFBa0IsRUFBVSxPQUFlLEVBQ3hFLE9BQWU7UUFEZixVQUFLLEdBQUwsS0FBSyxDQUFjO1FBQVUsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUFVLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFDeEUsWUFBTyxHQUFQLE9BQU8sQ0FBUTtJQUFHLENBQUM7SUFFdkMsSUFBWSxlQUFlO1FBQ3pCLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUM5RixDQUFDO0lBRUQsSUFBSSxPQUFPLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUM1QyxJQUFJLFNBQVM7UUFDWCxJQUFJLGNBQWMsR0FBRyxJ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LENBQUM7WUFDaEMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNuQixDQUFDO0FBQ0gsQ0FBQztBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtpc1ByZXNlbnQsIGlzQmxhbmssIENPTlNUfSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuaW1wb3J0IHtMaXN0V3JhcHBlciwgU3RyaW5nTWFwV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcbmltcG9ydCB7SW5qZWN0b3J9IGZyb20gJ2FuZ3VsYXIyL3NyYy9jb3JlL2RpJztcbmltcG9ydCB7UmVuZGVyRGVidWdJbmZvfSBmcm9tICdhbmd1bGFyMi9zcmMvY29yZS9yZW5kZXIvYXBpJztcbmltcG9ydCB7QXBwVmlld30gZnJvbSAnLi92aWV3JztcbmltcG9ydCB7Vmlld1R5cGV9IGZyb20gJy4vdmlld190eXBlJztcblxuQENPTlNUKClcbmV4cG9ydCBjbGFzcyBTdGF0aWNOb2RlRGVidWdJbmZvIHtcbiAgY29uc3RydWN0b3IocHVibGljIHByb3ZpZGVyVG9rZW5zOiBhbnlbXSwgcHVibGljIGNvbXBvbmVudFRva2VuOiBhbnksXG4gICAgICAgICAgICAgIHB1YmxpYyByZWZUb2tlbnM6IHtba2V5OiBzdHJpbmddOiBhbnl9KSB7fVxufVxuXG5leHBvcnQgY2xhc3MgRGVidWdDb250ZXh0IGltcGxlbWVudHMgUmVuZGVyRGVidWdJbmZvIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBfdmlldzogQXBwVmlldzxhbnk+LCBwcml2YXRlIF9ub2RlSW5kZXg6IG51bWJlciwgcHJpdmF0ZSBfdHBsUm93OiBudW1iZXIsXG4gICAgICAgICAgICAgIHByaXZhdGUgX3RwbENvbDogbnVtYmVyKSB7fVxuXG4gIHByaXZhdGUgZ2V0IF9zdGF0aWNOb2RlSW5mbygpOiBTdGF0aWNOb2RlRGVidWdJbmZvIHtcbiAgICByZXR1cm4gaXNQcmVzZW50KHRoaXMuX25vZGVJbmRleCkgPyB0aGlzLl92aWV3LnN0YXRpY05vZGVEZWJ1Z0luZm9zW3RoaXMuX25vZGVJbmRleF0gOiBudWxsO1xuICB9XG5cbiAgZ2V0IGNvbnRleHQoKSB7IHJldHVybiB0aGlzLl92aWV3LmNvbnRleHQ7IH1cbiAgZ2V0IGNvbXBvbmVudCgpIHtcbiAgICB2YXIgc3RhdGljTm9kZUluZm8gPSB0aGlzLl9zdGF0aWNOb2RlSW5mbztcbiAgICBpZiAoaXNQcmVzZW50KHN0YXRpY05vZGVJbmZvKSAmJiBpc1ByZXNlbnQoc3RhdGljTm9kZUluZm8uY29tcG9uZW50VG9rZW4pKSB7XG4gICAgICByZXR1cm4gdGhpcy5pbmplY3Rvci5nZXQoc3RhdGljTm9kZUluZm8uY29tcG9uZW50VG9rZW4pO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBnZXQgY29tcG9uZW50UmVuZGVyRWxlbWVudCgpIHtcbiAgICB2YXIgY29tcG9uZW50VmlldyA9IHRoaXMuX3ZpZXc7XG4gICAgd2hpbGUgKGlzUHJlc2VudChjb21wb25lbnRWaWV3LmRlY2xhcmF0aW9uQXBwRWxlbWVudCkgJiZcbiAgICAgICAgICAgY29tcG9uZW50Vmlldy50eXBlICE9PSBWaWV3VHlwZS5DT01QT05FTlQpIHtcbiAgICAgIGNvbXBvbmVudFZpZXcgPSBjb21wb25lbnRWaWV3LmRlY2xhcmF0aW9uQXBwRWxlbWVudC5wYXJlbnRWaWV3O1xuICAgIH1cbiAgICByZXR1cm4gaXNQcmVzZW50KGNvbXBvbmVudFZpZXcuZGVjbGFyYXRpb25BcHBFbGVtZW50KSA/XG4gICAgICAgICAgICAgICBjb21wb25lbnRWaWV3LmRlY2xhcmF0aW9uQXBwRWxlbWVudC5uYXRpdmVFbGVtZW50IDpcbiAgICAgICAgICAgICAgIG51bGw7XG4gIH1cbiAgZ2V0IGluamVjdG9yKCk6IEluamVjdG9yIHsgcmV0dXJuIHRoaXMuX3ZpZXcuaW5qZWN0b3IodGhpcy5fbm9kZUluZGV4KTsgfVxuICBnZXQgcmVuZGVyTm9kZSgpOiBhbnkge1xuICAgIGlmIChpc1ByZXNlbnQodGhpcy5fbm9kZUluZGV4KSAmJiBpc1ByZXNlbnQodGhpcy5fdmlldy5hbGxOb2RlcykpIHtcbiAgICAgIHJldHVybiB0aGlzLl92aWV3LmFsbE5vZGVzW3RoaXMuX25vZGVJbmRleF07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICBnZXQgcHJvdmlkZXJUb2tlbnMoKTogYW55W10ge1xuICAgIHZhciBzdGF0aWNOb2RlSW5mbyA9IHRoaXMuX3N0YXRpY05vZGVJbmZvO1xuICAgIHJldHVybiBpc1ByZXNlbnQoc3RhdGljTm9kZUluZm8pID8gc3RhdGljTm9kZUluZm8ucHJvdmlkZXJUb2tlbnMgOiBudWxsO1xuICB9XG4gIGdldCBzb3VyY2UoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7dGhpcy5fdmlldy5jb21wb25lbnRUeXBlLnRlbXBsYXRlVXJsfToke3RoaXMuX3RwbFJvd306JHt0aGlzLl90cGxDb2x9YDtcbiAgfVxuICBnZXQgcmVmZXJlbmNlcygpOiB7W2tleTogc3RyaW5nXTogYW55fSB7XG4gICAgdmFyIHZhclZhbHVlczoge1trZXk6IHN0cmluZ106IHN0cmluZ30gPSB7fTtcbiAgICB2YXIgc3RhdGljTm9kZUluZm8gPSB0aGlzLl9zdGF0aWNOb2RlSW5mbztcbiAgICBpZiAoaXNQcmVzZW50KHN0YXRpY05vZGVJbmZvKSkge1xuICAgICAgdmFyIHJlZnMgPSBzdGF0aWNOb2RlSW5mby5yZWZUb2tlbnM7XG4gICAgICBTdHJpbmdNYXBXcmFwcGVyLmZvckVhY2gocmVmcywgKHJlZlRva2VuLCByZWZOYW1lKSA9PiB7XG4gICAgICAgIHZhciB2YXJWYWx1ZTtcbiAgICAgICAgaWYgKGlzQmxhbmsocmVmVG9rZW4pKSB7XG4gICAgICAgICAgdmFyVmFsdWUgPSBpc1ByZXNlbnQodGhpcy5fdmlldy5hbGxOb2RlcykgPyB0aGlzLl92aWV3LmFsbE5vZGVzW3RoaXMuX25vZGVJbmRleF0gOiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhclZhbHVlID0gdGhpcy5fdmlldy5pbmplY3RvckdldChyZWZUb2tlbiwgdGhpcy5fbm9kZUluZGV4LCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgICB2YXJWYWx1ZXNbcmVmTmFtZV0gPSB2YXJWYWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdmFyVmFsdWVzO1xuICB9XG59XG4iXX0=