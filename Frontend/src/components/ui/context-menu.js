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
exports.ContextMenu = ContextMenu;
exports.ContextMenuTrigger = ContextMenuTrigger;
exports.ContextMenuContent = ContextMenuContent;
exports.ContextMenuItem = ContextMenuItem;
exports.ContextMenuCheckboxItem = ContextMenuCheckboxItem;
exports.ContextMenuRadioItem = ContextMenuRadioItem;
exports.ContextMenuLabel = ContextMenuLabel;
exports.ContextMenuSeparator = ContextMenuSeparator;
exports.ContextMenuShortcut = ContextMenuShortcut;
exports.ContextMenuGroup = ContextMenuGroup;
exports.ContextMenuPortal = ContextMenuPortal;
exports.ContextMenuSub = ContextMenuSub;
exports.ContextMenuSubContent = ContextMenuSubContent;
exports.ContextMenuSubTrigger = ContextMenuSubTrigger;
exports.ContextMenuRadioGroup = ContextMenuRadioGroup;
var React = require("react");
var ContextMenuPrimitive = require("@radix-ui/react-context-menu@2.2.6");
var lucide_react_0_487_0_1 = require("lucide-react@0.487.0");
var utils_1 = require("./utils");
function ContextMenu(_a) {
    var props = __rest(_a, []);
    return <ContextMenuPrimitive.Root data-slot="context-menu" {...props}/>;
}
function ContextMenuTrigger(_a) {
    var props = __rest(_a, []);
    return (<ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props}/>);
}
function ContextMenuGroup(_a) {
    var props = __rest(_a, []);
    return (<ContextMenuPrimitive.Group data-slot="context-menu-group" {...props}/>);
}
function ContextMenuPortal(_a) {
    var props = __rest(_a, []);
    return (<ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props}/>);
}
function ContextMenuSub(_a) {
    var props = __rest(_a, []);
    return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props}/>;
}
function ContextMenuRadioGroup(_a) {
    var props = __rest(_a, []);
    return (<ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props}/>);
}
function ContextMenuSubTrigger(_a) {
    var className = _a.className, inset = _a.inset, children = _a.children, props = __rest(_a, ["className", "inset", "children"]);
    return (<ContextMenuPrimitive.SubTrigger data-slot="context-menu-sub-trigger" data-inset={inset} className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
      {children}
      <lucide_react_0_487_0_1.ChevronRightIcon className="ml-auto"/>
    </ContextMenuPrimitive.SubTrigger>);
}
function ContextMenuSubContent(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<ContextMenuPrimitive.SubContent data-slot="context-menu-sub-content" className={(0, utils_1.cn)("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg", className)} {...props}/>);
}
function ContextMenuContent(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content data-slot="context-menu-content" className={(0, utils_1.cn)("bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md", className)} {...props}/>
    </ContextMenuPrimitive.Portal>);
}
function ContextMenuItem(_a) {
    var className = _a.className, inset = _a.inset, _b = _a.variant, variant = _b === void 0 ? "default" : _b, props = __rest(_a, ["className", "inset", "variant"]);
    return (<ContextMenuPrimitive.Item data-slot="context-menu-item" data-inset={inset} data-variant={variant} className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}/>);
}
function ContextMenuCheckboxItem(_a) {
    var className = _a.className, children = _a.children, checked = _a.checked, props = __rest(_a, ["className", "children", "checked"]);
    return (<ContextMenuPrimitive.CheckboxItem data-slot="context-menu-checkbox-item" className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <lucide_react_0_487_0_1.CheckIcon className="size-4"/>
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>);
}
function ContextMenuRadioItem(_a) {
    var className = _a.className, children = _a.children, props = __rest(_a, ["className", "children"]);
    return (<ContextMenuPrimitive.RadioItem data-slot="context-menu-radio-item" className={(0, utils_1.cn)("focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <lucide_react_0_487_0_1.CircleIcon className="size-2 fill-current"/>
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>);
}
function ContextMenuLabel(_a) {
    var className = _a.className, inset = _a.inset, props = __rest(_a, ["className", "inset"]);
    return (<ContextMenuPrimitive.Label data-slot="context-menu-label" data-inset={inset} className={(0, utils_1.cn)("text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)} {...props}/>);
}
function ContextMenuSeparator(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<ContextMenuPrimitive.Separator data-slot="context-menu-separator" className={(0, utils_1.cn)("bg-border -mx-1 my-1 h-px", className)} {...props}/>);
}
function ContextMenuShortcut(_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<span data-slot="context-menu-shortcut" className={(0, utils_1.cn)("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...props}/>);
}
