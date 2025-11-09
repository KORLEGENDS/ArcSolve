'use client';

import { Badge } from '@/client/components/ui/badge';
import { Link } from '@/share/libs/i18n/routing';
import clsx from 'clsx';
import Image from 'next/image';
import React from 'react';
import styles from './ArcLogo.module.css';

export interface ArcLogoProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  className?: string;
  label?: string;
  href?: string;
  disableLink?: boolean;
  size?: string;
}

export interface ArcLogoTaglineProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ArcLogoImageProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  className?: string;
  href?: string;
  disableLink?: boolean;
  imageSrc?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  size?: string;
}

export function ArcLogo({ className, label = 'ArcSolve', href = '/', disableLink = false, size = '1.5rem', ...anchorProps }: Readonly<ArcLogoProps>): React.ReactElement {
  const style = size ? { fontSize: size } : undefined;

  if (disableLink) {
    return (
      <span className={clsx(styles.logo, 'brand-text', className)} style={style} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={clsx(styles.logo, 'brand-text', className)} style={style} {...anchorProps}>
      {label}
    </Link>
  );
}

export function ArcLogoImage({
  className,
  href = '/',
  disableLink = false,
  imageSrc = '/logo.png',
  imageAlt = 'ArcSolve Logo',
  imageWidth = 32,
  imageHeight = 32,
  size,
  ...anchorProps
}: Readonly<ArcLogoImageProps>): React.ReactElement {
  const style = size ? { fontSize: size } : undefined;

  const content = (
    <span className={clsx(styles.logoImageOnly, 'brand-text', className)} style={style}>
      <Image
        src={imageSrc}
        alt={imageAlt}
        width={imageWidth}
        height={imageHeight}
        className={styles.logoImageCircular}
        priority
      />
    </span>
  );

  if (disableLink) {
    return (
      <span aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link href={href} {...anchorProps}>
      {content}
    </Link>
  );
}

export function ArcLogoTagline({ className, children = '지식의 잠재공간, 무한한 가능성' }: Readonly<ArcLogoTaglineProps>): React.ReactElement {
  return (
    <p className={clsx(styles.tagline, className, 'brand-text')} aria-hidden="true">
      {children}
    </p>
  );
}

export interface ArcBusinessInfoProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  companyName?: string;
  ownerName?: string;
  businessRegistrationNumber?: string;
  mailOrderReportNumber?: string;
  businessAddress?: string;
  phoneNumber?: string;
  separator?: React.ReactNode;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  inquiryUrl?: string;
}

export function ArcBusinessInfo({
  className,
  companyName = '아크솔브 (ARC‑SOLVE)',
  ownerName = '조경민',
  businessRegistrationNumber = '843-54-01035',
  mailOrderReportNumber = '2025-서울성북-1104',
  businessAddress = '서울특별시 성북구 장위로19길 25, 1동 302호 (장위동, 장위 에스하임1)',
  phoneNumber = '010-4996-1228',
  separator = '•',
  privacyPolicyUrl = '/docs/privacy',
  termsOfServiceUrl = '/docs/terms',
  inquiryUrl = 'http://pf.kakao.com/_HqBxcn/chat',
  ...divProps
}: Readonly<ArcBusinessInfoProps>): React.ReactElement {
  const phoneHref = React.useMemo(() => `tel:${(phoneNumber || '').replace(/\D/g, '')}`, [phoneNumber]);

  return (
    <div className={clsx(styles.businessInfoContainer, className)} role="contentinfo" {...divProps}>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>상호</strong>
        <span className={styles.businessInfoValue}>: {companyName}</span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>대표</strong>
        <span className={styles.businessInfoValue}>: {ownerName}</span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>사업자등록번호</strong>
        <span className={styles.businessInfoValue}>: {businessRegistrationNumber}</span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>통신판매업신고번호</strong>
        <span className={styles.businessInfoValue}>
          : <a
            className={styles.businessInfoLink}
            href="https://www.ftc.go.kr/bizCommList.do?key=232"
            target="_blank"
            rel="noopener noreferrer"
            title="공정거래위원회 사업자정보공개 페이지로 이동"
          >
            {mailOrderReportNumber}
          </a>
        </span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>사업장주소</strong>
        <span className={styles.businessInfoValue}>: {businessAddress}</span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>개인정보처리방침</strong>
        <span className={styles.businessInfoValue}>
          : <a
            className={styles.businessInfoLink}
            href={privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="개인정보처리방침 페이지로 이동"
          >
            개인정보처리방침 보기
          </a>
        </span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>이용약관</strong>
        <span className={styles.businessInfoValue}>
          : <a
            className={styles.businessInfoLink}
            href={termsOfServiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="이용약관 페이지로 이동"
          >
            이용약관 보기
          </a>
        </span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>연락처</strong>
        <span className={styles.businessInfoValue}>
          : <a className={styles.businessInfoLink} href={phoneHref}>{phoneNumber}</a>
        </span>
      </span>
      <span className={styles.businessInfoSeparator} aria-hidden="true">{separator}</span>
      <span className={styles.businessInfoItem}>
        <strong className={styles.businessInfoLabel}>문의처</strong>
        <span className={styles.businessInfoValue}>
          : <a
            className={styles.businessInfoLink}
            href={inquiryUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="카카오톡 채널로 문의하기"
          >
            카카오톡 채널
          </a>
        </span>
      </span>
    </div>
  );
}

export interface ArcButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  label?: string;
}

export function ArcButton({
  className,
  label = 'Arc',
  ...divProps
}: Readonly<ArcButtonProps>): React.ReactElement {
  return (
    <Badge variant="outline" className={clsx(styles.aiButton, 'ai-stroke-border', className)} {...divProps}>
      <span className={styles.aiButtonText}>{label}</span>
    </Badge>
  );
}


export interface ArcCopyrightProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  text?: string;
}

export function ArcCopyright({
  className,
  text = '©2025 ArcSolve, Inc. All rights reserved.',
  ...divProps
}: Readonly<ArcCopyrightProps>): React.ReactElement {
  return (
    <div className={clsx(styles.copyrightContainer, className)} role="contentinfo" {...divProps}>
      <span className={styles.copyrightText}>{text}</span>
    </div>
  );
}