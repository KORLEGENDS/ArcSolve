'use client';

import { CaptionPlugin } from '@platejs/caption/react';
import {
    AudioPlugin,
    FilePlugin,
    ImagePlugin,
    MediaEmbedPlugin,
    PlaceholderPlugin,
    VideoPlugin,
} from '@platejs/media/react';
import { KEYS } from 'platejs';

import { AudioElement } from '../../ui/node/media-audio-node';
import { MediaEmbedElement } from '../../ui/node/media-embed-node';
import { FileElement } from '../../ui/node/media-file-node';
import { ImageElement } from '../../ui/node/media-image-node';
import { PlaceholderElement } from '../../ui/node/media-placeholder-node';
import { MediaPreviewDialog } from '../../ui/media-preview-dialog';
import { MediaUploadToast } from '../../ui/media-upload-toast';
import { VideoElement } from '../../ui/node/media-video-node';

export const MediaKit = [
  ImagePlugin.configure({
    options: { disableUploadInsert: true },
    render: { afterEditable: MediaPreviewDialog, node: ImageElement },
  }),
  MediaEmbedPlugin.withComponent(MediaEmbedElement),
  VideoPlugin.withComponent(VideoElement),
  AudioPlugin.withComponent(AudioElement),
  FilePlugin.withComponent(FileElement),
  PlaceholderPlugin.configure({
    options: { disableEmptyPlaceholder: true },
    render: { afterEditable: MediaUploadToast, node: PlaceholderElement },
  }),
  CaptionPlugin.configure({
    options: {
      query: {
        allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.file, KEYS.mediaEmbed],
      },
    },
  }),
];
