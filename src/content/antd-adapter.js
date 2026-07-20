// Ant Design Select rendered menus use .ant-select-item-option *without*
// role=option (it's on the list itself in some versions, not on items in
// others). To avoid duplicating the ARIA adapter, we synthesize the missing
// roles so the generic adapter handles AntD lists uniformly.
//
// We only touch lists that *aren't* virtualized — AntD's virtual list
// wraps items inside .rc-virtual-list-holder with aria-posinset attrs we
// already reject in the ARIA adapter. We additionally detect the holder
// class and skip those.
//
// Attributes we inject are tagged so restoreSynthesizedRoles can undo them
// when Burger is disabled.

const SYNTH_ATTR = "data-burger-antd-synth";
const SYNTH_VALUE_ATTR = "data-burger-antd-value";

function isVirtualizedHolder(menu) {
  return !!menu.querySelector(".rc-virtual-list-holder");
}

function synthesizeRoles(root) {
  const { queryAllDeep } = window.__usFirst.domWalk;
  const menus = queryAllDeep(root || document, ".ant-select-dropdown");
  let touched = 0;
  for (const menu of menus) {
    if (isVirtualizedHolder(menu)) continue;
    // Find the inner list and label it as a listbox if it isn't already.
    const list = menu.querySelector(".ant-select-item-option-grouped, .ant-select-item-option")?.parentElement;
    if (!list) continue;
    if (!list.hasAttribute("role")) {
      list.setAttribute("role", "listbox");
      list.setAttribute(SYNTH_ATTR, "listbox");
    }
    const items = list.querySelectorAll(".ant-select-item-option");
    for (const it of items) {
      if (!it.hasAttribute("role")) {
        it.setAttribute("role", "option");
        it.setAttribute(SYNTH_ATTR, "option");
      }
      if (!it.hasAttribute("data-value")) {
        // AntD stores the value on data-attr-value or the title attr.
        const val = it.getAttribute("title") || (it.textContent || "").trim();
        it.setAttribute("data-value", val);
        it.setAttribute(SYNTH_VALUE_ATTR, "1");
      }
      touched++;
    }
  }
  return touched;
}

function restoreSynthesizedRoles(root) {
  const { queryAllDeep } = window.__usFirst.domWalk;
  let restored = 0;
  for (const el of queryAllDeep(root || document, `[${SYNTH_ATTR}]`)) {
    el.removeAttribute("role");
    el.removeAttribute(SYNTH_ATTR);
    restored++;
  }
  for (const el of queryAllDeep(root || document, `[${SYNTH_VALUE_ATTR}]`)) {
    el.removeAttribute("data-value");
    el.removeAttribute(SYNTH_VALUE_ATTR);
  }
  return restored;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.antdAdapter = { synthesizeRoles, restoreSynthesizedRoles };
