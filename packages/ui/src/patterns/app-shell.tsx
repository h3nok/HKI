'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Button, Space, theme } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface UserProfile {
  name: string;
  department?: string | undefined;
  initials?: string | undefined;
}

interface AppShellProps {
  children: React.ReactNode;
  user?: UserProfile;
  mainNavItems: NavItem[];
  secondaryNavItems?: NavItem[];
  headerActions?: React.ReactNode;
  brandIcon?: React.ReactNode;
  brandName?: string;
  onSignOut?: () => void;
  submitAction?: React.ReactNode; // e.g., "Submit Idea" button
}

export function AppShell({ 
  children, 
  user,
  mainNavItems,
  secondaryNavItems = [],
  headerActions,
  brandIcon,
  brandName = 'Platform',
  onSignOut,
  submitAction
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Active key logic
  const allItems = [...mainNavItems, ...secondaryNavItems];
  const activeKey = allItems.find(item => pathname === item.href)?.key || '/';

  const userMenuPoints = [
    {
      key: 'user-info',
      label: (
        <div className="flex flex-col px-1.5 py-1">
          <span className="font-semibold">{user?.name}</span>
          <span className="text-xs text-gray-500">{user?.department}</span>
        </div>
      ),
      disabled: true, 
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'My Profile',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      danger: true,
      onClick: onSignOut,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        className="border-r border-gray-200"
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-100">
          {brandIcon}
          {!collapsed && (
            <span className="font-semibold text-lg text-primary truncate fade-in">
              {brandName}
            </span>
          )}
        </div>

        <div className="flex flex-col h-[calc(100vh-64px)] justify-between py-4">
          <div className="flex-1">
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              items={mainNavItems.map(item => ({
                key: item.key,
                icon: item.icon,
                label: <Link href={item.href}>{item.label}</Link>,
              }))}
              style={{ borderRight: 0 }}
            />
            
            {submitAction && (
              <>
                <div className="px-4 my-4">
                  <div className="h-px bg-gray-100 mx-2" />
                </div>
                <div className="px-4 mb-2">
                  {!collapsed ? (
                    submitAction
                  ) : (
                    <Button type="primary" shape="circle" icon={<PlusOutlined />} className="mx-auto block" />
                  )}
                </div>
              </>
            )}
          </div>

          <div>
             {secondaryNavItems.length > 0 && (
               <>
                 <div className="px-4 my-2">
                   <div className="h-px bg-gray-100 mx-2" />
                 </div>
                 <Menu
                   mode="inline"
                   selectedKeys={[activeKey]}
                   items={secondaryNavItems.map(item => ({
                     key: item.key,
                     icon: item.icon,
                     label: <Link href={item.href}>{item.label}</Link>,
                   }))}
                   style={{ borderRight: 0 }}
                 />
               </>
             )}
          </div>
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header 
          style={{ padding: '0 24px', background: colorBgContainer }} 
          className="flex items-center justify-between shadow-sm sticky top-0 z-50"
        >
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            {headerActions}

            <div className="h-6 w-px bg-gray-200 mx-1" />

            <Dropdown menu={{ items: userMenuPoints as any }} placement="bottomRight" arrow>
              <Space className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors">
                <Avatar 
                  size="default" 
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {user?.initials || 'U'}
                </Avatar>
                <div className="hidden md:flex flex-col leading-tight text-right">
                  <span className="font-medium text-sm">{user?.name}</span>
                  <span className="text-xs text-gray-500">{user?.department}</span>
                </div>
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: 'transparent',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
