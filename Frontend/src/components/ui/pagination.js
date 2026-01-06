"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pagination = Pagination;
exports.PaginationContent = PaginationContent;
exports.PaginationLink = PaginationLink;
exports.PaginationItem = PaginationItem;
exports.PaginationPrevious = PaginationPrevious;
exports.PaginationNext = PaginationNext;
exports.PaginationEllipsis = PaginationEllipsis;
var React = require("react");
var lucide_react_0_487_0_1 = require("lucide-react@0.487.0");
var utils_1 = require("./utils");
var button_1 = require("./button");
function Pagination(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<nav role="navigation" aria-label="pagination" data-slot="pagination" className={(0, utils_1.cn)("mx-auto flex w-full justify-center", className)} {...props}/>);
}
function PaginationContent(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<ul data-slot="pagination-content" className={(0, utils_1.cn)("flex flex-row items-center gap-1", className)} {...props}/>);
}
function PaginationItem(_a) {
    var props = __rest(_a, []);
    return <li data-slot="pagination-item" {...props}/>;
}
function PaginationLink(_a) {
    var className = _a.className, isActive = _a.isActive, _b = _a.size, size = _b === void 0 ? "icon" : _b, props = __rest(_a, ["className", "isActive", "size"]);
    return (<a aria-current={isActive ? "page" : undefined} data-slot="pagination-link" data-active={isActive} className={(0, utils_1.cn)((0, button_1.buttonVariants)({
            variant: isActive ? "outline" : "ghost",
            size: size,
        }), className)} {...props}/>);
}
function PaginationPrevious(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<PaginationLink aria-label="Go to previous page" size="default" className={(0, utils_1.cn)("gap-1 px-2.5 sm:pl-2.5", className)} {...props}>
      <lucide_react_0_487_0_1.ChevronLeftIcon />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>);
}
function PaginationNext(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<PaginationLink aria-label="Go to next page" size="default" className={(0, utils_1.cn)("gap-1 px-2.5 sm:pr-2.5", className)} {...props}>
      <span className="hidden sm:block">Next</span>
      <lucide_react_0_487_0_1.ChevronRightIcon />
    </PaginationLink>);
}
function PaginationEllipsis(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<span aria-hidden data-slot="pagination-ellipsis" className={(0, utils_1.cn)("flex size-9 items-center justify-center", className)} {...props}>
      <lucide_react_0_487_0_1.MoreHorizontalIcon className="size-4"/>
      <span className="sr-only">More pages</span>
    </span>);
}
