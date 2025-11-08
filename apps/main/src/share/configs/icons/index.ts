import {
  IconBrandYoutube,
  IconFileTypeCsv,
  IconFileTypeDoc,
  IconFileTypeDocx,
  IconFileTypeHtml,
  IconFileTypeJpg,
  IconFileTypePdf,
  IconFileTypePng,
  IconFileTypePpt,
  IconFileTypeSvg,
  IconFileTypeTxt,
  IconFileTypeXls,
  IconFileTypeZip,
} from '@tabler/icons-react';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Book,
  BookOpen,
  Box,
  Brain,
  Check,
  CheckCircle,
  ChevronDown,
  Circle,
  CirclePlus,
  CircleX,
  Clock,
  Copy,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileCode,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Focus,
  Folder,
  FolderOpen,
  FolderOpenDot,
  FolderPlus,
  Gauge,
  Home,
  Image,
  Languages,
  Layers,
  List,
  ListFilter,
  Loader2,
  Maximize2,
  Megaphone,
  Menu,
  MessageSquare,
  Microscope,
  Minimize2,
  Minus,
  Notebook,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  PenTool,
  Plus,
  Quote,
  RefreshCcw,
  Ruler,
  Scan,
  ScrollText,
  Search,
  Sparkles,
  Square,
  Star,
  StarOff,
  StickyNote,
  TextCursorInput,
  Type,
  Undo2,
  Upload,
  Wand2,
  Wrench,
  X,
  XCircle,
  XIcon,
  Zap
} from 'lucide-react';

import { createIconRegistry, type IconSources } from './registry-builder';
import { createIconFromToken, createIconRenderer, createRenderRegistryFileIcon, createResolveRegistryFileIcon, resolveIconRenderer, type ArcManagerFileConfig, type ExtractTokens, type IconProps, type IconRenderer } from './shared';

// Web-specific icon sources
const webLucideIcons = {
  arrowDown: createIconRenderer(ArrowDown),
  arrowLeft: createIconRenderer(ArrowLeft),
  arrowRight: createIconRenderer(ArrowRight),
  book: createIconRenderer(Book),
  bookOpen: createIconRenderer(BookOpen),
  box: createIconRenderer(Box),
  brain: createIconRenderer(Brain),
  check: createIconRenderer(Check),
  checkCircle: createIconRenderer(CheckCircle),
  chevronDown: createIconRenderer(ChevronDown),
  circle: createIconRenderer(Circle),
  circlePlus: createIconRenderer(CirclePlus),
  circleX: createIconRenderer(CircleX),
  clock: createIconRenderer(Clock),
  copy: createIconRenderer(Copy),
  languages: createIconRenderer(Languages),
  loader2: createIconRenderer(Loader2),
  layers: createIconRenderer(Layers),
  list: createIconRenderer(List),
  maximize: createIconRenderer(Maximize2),
  microscope: createIconRenderer(Microscope),
  minimize: createIconRenderer(Minimize2),
  minus: createIconRenderer(Minus),
  fileArchive: createIconRenderer(FileArchive),
  fileAudio: createIconRenderer(FileAudio),
  fileCode: createIconRenderer(FileCode),
  fileDefault: createIconRenderer(FileIcon),
  fileImage: createIconRenderer(FileImage),
  fileSpreadsheet: createIconRenderer(FileSpreadsheet),
  fileText: createIconRenderer(FileText),
  fileVideo: createIconRenderer(FileVideo),
  focus: createIconRenderer(Focus),
  folder: createIconRenderer(Folder),
  folderOpen: createIconRenderer(FolderOpen),
  folderOpenDot: createIconRenderer(FolderOpenDot),
  folderPlus: createIconRenderer(FolderPlus),
  gauge: createIconRenderer(Gauge),
  home: createIconRenderer(Home),
  messageSquare: createIconRenderer(MessageSquare),
  megaphone: createIconRenderer(Megaphone),
  notebook: createIconRenderer(Notebook),
  penTool: createIconRenderer(PenTool),
  plus: createIconRenderer(Plus),
  quote: createIconRenderer(Quote),
  refreshCcw: createIconRenderer(RefreshCcw),
  scan: createIconRenderer(Scan),
  scrollText: createIconRenderer(ScrollText),
  search: createIconRenderer(Search),
  searchIcon: createIconRenderer(Search),
  send: createIconRenderer(ArrowUp),
  sparkles: createIconRenderer(Sparkles),
  square: createIconRenderer(Square),
  type: createIconRenderer(Type),
  stickyNote: createIconRenderer(StickyNote),
  textCursorInput: createIconRenderer(TextCursorInput),
  star: createIconRenderer(Star),
  starOff: createIconRenderer(StarOff),
  menu: createIconRenderer(Menu),
  externalLink: createIconRenderer(ExternalLink),
  undo2: createIconRenderer(Undo2),
  upload: createIconRenderer(Upload),
  wand: createIconRenderer(Wand2),
  wrench: createIconRenderer(Wrench),
  xCircle: createIconRenderer(XCircle),
  x: createIconRenderer(X),
  xIcon: createIconRenderer(XIcon),
  zap: createIconRenderer(Zap),
  ruler: createIconRenderer(Ruler),
  pencil: createIconRenderer(Pencil),
  panelLeft: createIconRenderer(PanelLeft),
  panelLeftClose: createIconRenderer(PanelLeftClose),
  image: createIconRenderer(Image),
  archive: createIconRenderer(Archive),
  listFilter: createIconRenderer(ListFilter),
} as const;

const webTablerFileIcons = {
  csv: createIconRenderer(IconFileTypeCsv, { stroke: 2 }),
  doc: createIconRenderer(IconFileTypeDoc, { stroke: 2 }),
  docx: createIconRenderer(IconFileTypeDocx, { stroke: 2 }),
  html: createIconRenderer(IconFileTypeHtml, { stroke: 2 }),
  jpg: createIconRenderer(IconFileTypeJpg, { stroke: 2 }),
  jpeg: createIconRenderer(IconFileTypeJpg, { stroke: 2 }),
  pdf: createIconRenderer(IconFileTypePdf, { stroke: 2 }),
  png: createIconRenderer(IconFileTypePng, { stroke: 2 }),
  ppt: createIconRenderer(IconFileTypePpt, { stroke: 2 }),
  svg: createIconRenderer(IconFileTypeSvg, { stroke: 2 }),
  txt: createIconRenderer(IconFileTypeTxt, { stroke: 2 }),
  xls: createIconRenderer(IconFileTypeXls, { stroke: 2 }),
  zip: createIconRenderer(IconFileTypeZip, { stroke: 2 }),
} as const;

const webTablerBrandIcons = {
  youtube: createIconRenderer(IconBrandYoutube, { stroke: 2 }),
} as const;

// Create web-specific icon registry
const webIconSources: IconSources = {
  lucide: webLucideIcons,
  tablerFile: webTablerFileIcons,
  tablerBrand: webTablerBrandIcons,
};

export const iconRegistry = createIconRegistry(webIconSources);

export type IconToken = ExtractTokens<typeof iconRegistry>;
export type ArcManagerIconToken = ExtractTokens<
  (typeof iconRegistry)['arc']['core']['arcManager'],
  'arc.core.arcManager'
>;
export type ArcViewerIconToken = ExtractTokens<
  (typeof iconRegistry)['arc']['service']['arcViewer'],
  'arc.service.arcViewer'
>;

// Web-specific exports
export const resolveIconRendererWeb = (token: string): IconRenderer | undefined => {
  return resolveIconRenderer(token, iconRegistry);
};

export const iconFromToken = (token: string, props?: IconProps): React.ReactNode => {
  return createIconFromToken(token, iconRegistry, iconRegistry.common.fallback, props);
};

export const iconComponentFromToken = (token: string) => {
  const renderer = resolveIconRenderer(token, iconRegistry) ?? iconRegistry.common.fallback;
  return renderer;
};

// Web-specific file icon helpers
const webArcManagerFileConfig = iconRegistry.arc.core.arcManager.config.file;

export const resolveRegistryFileIcon = (params?: {
  name?: string;
  mimeType?: string | null;
}): IconRenderer => {
  return createResolveRegistryFileIcon(params ?? {}, webArcManagerFileConfig as ArcManagerFileConfig);
};

export const renderRegistryFileIcon = (params?: {
  name?: string;
  mimeType?: string | null;
  className?: string;
  size?: number | string;
  'aria-hidden'?: boolean;
}): React.ReactNode => {
  return createRenderRegistryFileIcon(params ?? {}, webArcManagerFileConfig as ArcManagerFileConfig);
};


