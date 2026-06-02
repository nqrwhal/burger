// Ant Design Select rendered menus use .ant-select-item-option *without*
// role=option (it's on the list itself in some versions, not on items in
// others). To avoid duplicating the ARIA adapter, we synthesize the missing
// roles so the generic adapter handles AntD lists uniformly.
//
// We only touch lists that *aren't* virtualized — AntD's virtual list
// wraps items inside .rc-virtual-list-holder with aria-posinset attrs we
// already reject in the ARIA adapter. We additionally detect the holder
// class and skip those.

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
    if (!list.hasAttribute("role")) list.setAttribute("role", "listbox");
    const items = list.querySelectorAll(".ant-select-item-option");
    for (const it of items) {
      if (!it.hasAttribute("role")) it.setAttribute("role", "option");
      if (!it.hasAttribute("data-value")) {
        // AntD stores the value on data-attr-value or the title attr.
        const val = it.getAttribute("title") || (it.textContent || "").trim();
        it.setAttribute("data-value", val);
      }
      touched++;
    }
  }
  return touched;
}

window.__usFirst = window.__usFirst || {};
window.__usFirst.antdAdapter = { synthesizeRoles };
