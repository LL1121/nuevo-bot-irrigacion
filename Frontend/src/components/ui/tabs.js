"use client";
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
exports.Tabs = Tabs;
exports.TabsList = TabsList;
exports.TabsTrigger = TabsTrigger;
exports.TabsContent = TabsContent;
var React = require("react");
var TabsPrimitive = require("@radix-ui/react-tabs@1.1.3");
var utils_1 = require("./utils");
function Tabs(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<TabsPrimitive.Root data-slot="tabs" className={(0, utils_1.cn)("flex flex-col gap-2", className)} {...props}/>);
}
function TabsList(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<TabsPrimitive.List data-slot="tabs-list" className={(0, utils_1.cn)("bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-xl p-[3px] flex", className)} {...props}/>);
}
function TabsTrigger(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<TabsPrimitive.Trigger data-slot="tabs-trigger" className={(0, utils_1.cn)("data-[state=active]:bg-card dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}/>);
}
function TabsContent(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<TabsPrimitive.Content data-slot="tabs-content" className={(0, utils_1.cn)("flex-1 outline-none", className)} {...props}/>);
}
