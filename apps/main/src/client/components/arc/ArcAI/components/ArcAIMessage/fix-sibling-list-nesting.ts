import type { List, ListItem, Root } from 'mdast';
import type { Plugin } from 'unified';

/**
 * remarkFixSiblingListNesting
 *
 * Heuristic normalization for LLM-generated Markdown where a bullet list (ul)
 * placed immediately after a numbered list (ol) at the same indentation level
 * should actually be a child list of the last list item in the preceding ol.
 *
 * Pattern fixed (siblings → nested):
 *   [ ... , List(ordered=true), List(ordered=false), ... ]
 * becomes
 *   List(ordered=true, children=[ ..., ListItem(children=[ ..., List(ordered=false) ]) ])
 *
 * Conditions:
 * - Lists are adjacent siblings under the same parent
 * - First list is ordered (ol), second is unordered (ul)
 * - Both lists start at the same column (same indentation) → indicates 0-indent ul
 */
const remarkFixSiblingListNesting: Plugin<[], Root> = () => {
  return (tree: Root) => {
    function process(parent: any): void {
      const children: any[] | undefined = parent?.children;
      if (!Array.isArray(children) || children.length === 0) return;

      let i = 0;
      while (i < children.length - 1) {
        const current = children[i];
        const next = children[i + 1];

        // Recurse into current before structural edits on siblings below
        if (current && current.children) {
          process(current);
        }

        if (
          current?.type === 'list' &&
          next?.type === 'list' &&
          (current as List).ordered === true &&
          (next as List).ordered === false
        ) {
          const curCol = current.position?.start?.column;
          const nextCol = next.position?.start?.column;
          const sameColumn =
            typeof curCol === 'number' && typeof nextCol === 'number' && curCol === nextCol;

          if (sameColumn) {
            const listA = current as List;
            const listB = next as List;
            const lastItem = listA.children[listA.children.length - 1] as ListItem | undefined;
            if (lastItem) {
              if (!Array.isArray(lastItem.children)) {
                (lastItem as any).children = [];
              }
              (lastItem.children as any[]).push(listB);
              // remove the sibling ul from parent
              children.splice(i + 1, 1);
              // do not advance i to re-evaluate potential further siblings
              continue;
            }
          }
        }

        i += 1;
      }

      // Recurse into the last child as well
      const last = children[children.length - 1];
      if (last && last.children) {
        process(last);
      }
    }

    process(tree as any);
  };
};

export default remarkFixSiblingListNesting;


