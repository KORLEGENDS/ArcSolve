import type { IconRenderer } from './shared';

export interface IconSources {
  lucide: Record<string, IconRenderer>;
  tablerFile: Record<string, IconRenderer>;
  tablerBrand: Record<string, IconRenderer>;
}

export const createIconRegistry = (sources: IconSources) => {
  const { lucide: lucideIcons, tablerFile: tablerFileIcons, tablerBrand: tablerBrandIcons } = sources;

  return {
    arc: {
      core: {
        arcWork: {
          tab: {
            components: {
              default: lucideIcons.sparkles,
              arcnote: lucideIcons.notebook,
              arcviewer: lucideIcons.fileText,
              arcchat: lucideIcons.messageSquare,
            },
            close: lucideIcons.x,
          },
          header: {
            prefix: {
              menu: lucideIcons.menu,
              close: lucideIcons.x,
            },
            left: {
              addPanel: lucideIcons.plus,
            },
            right: {
              float: {
                dock: lucideIcons.undo2,
                float: lucideIcons.externalLink,
              },
              maximize: {
                maximize: lucideIcons.maximize,
                minimize: lucideIcons.minimize,
              },
            },
          },
          loader: lucideIcons.loader2,
          launcher: {
            youtube: tablerBrandIcons.youtube,
          },
        },
        arcManager: {
          adapters: {
            file: {
              upload: lucideIcons.upload,
              folderCreate: lucideIcons.folderPlus,
              videoFile: lucideIcons.fileVideo,
            },
            note: {
              folderCreate: lucideIcons.folderPlus,
            },
            chat: {
              create: lucideIcons.circlePlus,
            },
          },
          pane: {
            home: lucideIcons.home,
          },
          presenters: {
            tree: {
              root: lucideIcons.box,
              folder: lucideIcons.folder,
              folderOpen: lucideIcons.folderOpen,
              loading: lucideIcons.loader2,
              favorite: lucideIcons.star,
              favoriteOff: lucideIcons.starOff,
            },
            toolbar: {
              search: lucideIcons.search,
              clear: lucideIcons.x,
            },
          },
          config: {
            tabs: {
              files: lucideIcons.folderOpenDot,
              chat: lucideIcons.messageSquare,
              notes: lucideIcons.notebook,
            },
            note: {
              default: lucideIcons.notebook,
              draw: lucideIcons.penTool,
            },
            file: {
              default: lucideIcons.fileDefault,
              folder: lucideIcons.box,
              brands: {
                youtube: tablerBrandIcons.youtube,
              },
              extensions: {
                ...tablerFileIcons,
              },
              groups: {
                image: lucideIcons.fileImage,
                video: lucideIcons.fileVideo,
                audio: lucideIcons.fileAudio,
                archive: lucideIcons.fileArchive,
                spreadsheet: lucideIcons.fileSpreadsheet,
                code: lucideIcons.fileCode,
                text: lucideIcons.fileText,
                document: lucideIcons.fileText,
                presentation: lucideIcons.fileText,
                pdf: lucideIcons.fileText,
                other: lucideIcons.fileDefault,
              },
            },
          },
        },
      },
      service: {
        arcChat: {
          state: {
            loading: lucideIcons.loader2,
            error: lucideIcons.circleX,
          },
          context: {
            container: {
              image: lucideIcons.image,
              filter: lucideIcons.listFilter,
            },
            list: {
              note: {
                default: lucideIcons.notebook,
                draw: lucideIcons.penTool,
                selected: lucideIcons.check,
                remove: lucideIcons.x,
              },
              file: {
                folder: lucideIcons.folder,
                image: lucideIcons.image,
                archive: lucideIcons.archive,
                default: lucideIcons.fileText,
              },
            },
          },
          message: {
            action: {
              copied: lucideIcons.check,
              copy: lucideIcons.copy,
              edit: lucideIcons.pencil,
              retry: lucideIcons.refreshCcw,
              delete: lucideIcons.x,
            },
            reasoning: {
              brain: lucideIcons.brain,
              toggle: lucideIcons.chevronDown,
            },
            tool: {
              status: {
                pending: lucideIcons.circle,
                running: lucideIcons.clock,
                completed: lucideIcons.checkCircle,
                error: lucideIcons.xCircle,
              },
              toggle: lucideIcons.chevronDown,
              type: lucideIcons.wrench,
            },
            inlineCitation: {
              prev: lucideIcons.arrowLeft,
              next: lucideIcons.arrowRight,
            },
            task: {
              toggle: lucideIcons.chevronDown,
              icon: lucideIcons.search,
            },
            source: {
              toggle: lucideIcons.chevronDown,
              icon: lucideIcons.book,
            },
            summary: {
              toggle: lucideIcons.chevronDown,
              icon: lucideIcons.scrollText,
            },
          },
          input: {
            submit: {
              send: lucideIcons.send,
              stop: lucideIcons.square,
            },
            meta: {
              intelligence: lucideIcons.brain,
              outputLength: lucideIcons.ruler,
              responseDetail: lucideIcons.layers,
              reasoningDepth: lucideIcons.sparkles,
              sparkles: lucideIcons.sparkles,
            },
            options: {
              intelligence: {
                low: lucideIcons.zap,
                medium: lucideIcons.gauge,
                high: lucideIcons.brain,
              },
              outputLength: {
                low: lucideIcons.minimize,
                medium: lucideIcons.list,
                high: lucideIcons.maximize,
              },
              reasoningDepth: {
                low: lucideIcons.focus,
                medium: lucideIcons.scan,
                high: lucideIcons.microscope,
              },
              responseDetail: {
                low: lucideIcons.textCursorInput,
                medium: lucideIcons.fileText,
                high: lucideIcons.bookOpen,
              },
            },
            tools: {
              close: lucideIcons.xIcon,
            },
          },
          ui: {
            webPreview: {
              console: {
                toggle: lucideIcons.chevronDown,
              },
            },
          },
          conversation: {
            scrollToBottom: lucideIcons.arrowDown,
          },
        },
        arcNote: {
          tag: {
            dot: lucideIcons.circle,
            remove: lucideIcons.x,
          },
        },
        arcViewer: {
          state: {
            loading: lucideIcons.loader2,
            error: lucideIcons.circleX,
          },
          toolbar: {
            sidebar: {
              open: lucideIcons.panelLeft,
              close: lucideIcons.panelLeftClose,
            },
            zoom: {
              out: lucideIcons.minus,
              reset: lucideIcons.square,
              in: lucideIcons.plus,
              fitWidth: lucideIcons.maximize,
            },
            text: {
              toggle: lucideIcons.type,
            },
            overlay: {
              toggle: lucideIcons.layers,
            },
            translate: {
              toggle: lucideIcons.stickyNote,
            },
            rangeCitation: {
              trigger: lucideIcons.quote,
              copy: lucideIcons.copy,
              success: lucideIcons.check,
            },
            noteMenu: {
              notebook: lucideIcons.notebook,
              range: lucideIcons.quote,
              full: lucideIcons.layers,
            },
          },
          chatbar: {
            reset: lucideIcons.refreshCcw,
          },
          floatingToolbar: {
            copy: lucideIcons.copy,
            imageCopy: lucideIcons.image,
            cite: lucideIcons.quote,
            success: lucideIcons.check,
            translate: lucideIcons.languages,
          },
        },
      },
    },
    common: {
      fallback: lucideIcons.fileText,
    },
  } as const;
};
