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
exports.Alert = Alert;
exports.AlertTitle = AlertTitle;
exports.AlertDescription = AlertDescription;
var React = require("react");
var class_variance_authority_0_7_1_1 = require("class-variance-authority@0.7.1");
var utils_1 = require("./utils");
var alertVariants = (0, class_variance_authority_0_7_1_1.cva)("relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current", {
    variants: {
        variant: {
            default: "bg-card text-card-foreground",
            destructive: "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function Alert(_a) {
    var className = _a.className, variant = _a.variant, props = __rest(_a, ["className", "variant"]);
    return (<div data-slot="alert" role="alert" className={(0, utils_1.cn)(alertVariants({ variant: variant }), className)} {...props}/>);
}
function AlertTitle(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<div data-slot="alert-title" className={(0, utils_1.cn)("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)} {...props}/>);
}
function AlertDescription(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<div data-slot="alert-description" className={(0, utils_1.cn)("text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed", className)} {...props}/>);
}
