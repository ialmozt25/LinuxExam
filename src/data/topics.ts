import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck, FolderOpen, Cpu, Terminal, FileText, Code,
  Activity, Package, HardDrive, Database, Settings, Wifi,
  Users, Lock,
} from 'lucide-react';

export type TopicStatus = 'available' | 'planned';

export interface TopicConfig {
  key: string;
  title: string;
  description: string;
  status: TopicStatus;
  Icon: LucideIcon;
}

export const TOPICS: TopicConfig[] = [
  { key: 'file_permissions', title: 'Права доступа',
    description: 'chmod, chown, ACL, umask, special bits',
    status: 'available', Icon: ShieldCheck },
  { key: 'file_management', title: 'Управление файлами',
    description: 'cp, mv, find, tar, links, redirection',
    status: 'available', Icon: FolderOpen },
  { key: 'process_management', title: 'Управление процессами',
    description: 'ps, top, kill, systemctl, journalctl',
    status: 'available', Icon: Cpu },
  { key: 'essential_tools', title: 'Базовые инструменты',
    description: 'shell, grep, ssh, tar, man pages',
    status: 'available', Icon: Terminal },
  { key: 'text_files', title: 'Работа с текстом',
    description: 'sed, awk, cut, sort, uniq, tr, wc, head/tail',
    status: 'planned', Icon: FileText },
  { key: 'shell_scripts', title: 'Shell-скрипты',
    description: 'if, loops, args, command substitution',
    status: 'available', Icon: Code },
  { key: 'running_systems', title: 'Управление системами',
    description: 'boot targets, services, journals',
    status: 'planned', Icon: Activity },
  { key: 'manage_software', title: 'Управление ПО',
    description: 'dnf, rpm, repositories, Flatpak',
    status: 'planned', Icon: Package },
  { key: 'local_storage', title: 'Локальное хранилище',
    description: 'partitions, LVM, mount by UUID, swap',
    status: 'planned', Icon: HardDrive },
  { key: 'file_systems', title: 'Файловые системы',
    description: 'ext4, xfs, NFS, autofs, fstab',
    status: 'planned', Icon: Database },
  { key: 'deploy_systems', title: 'Развёртывание систем',
    description: 'at, cron, systemd services, tuning',
    status: 'planned', Icon: Settings },
  { key: 'networking', title: 'Сеть',
    description: 'nmcli, hostname, /etc/hosts, firewalld',
    status: 'available', Icon: Wifi },
  { key: 'users_groups', title: 'Пользователи и группы',
    description: 'useradd, usermod, sudo, /etc/passwd',
    status: 'available', Icon: Users },
  { key: 'security', title: 'Безопасность',
    description: 'SELinux, firewalld, SSH keys, sudo',
    status: 'available', Icon: Lock },
];

export const AVAILABLE_TOPICS = TOPICS.filter((t) => t.status === 'available');
export const PLANNED_TOPICS = TOPICS.filter((t) => t.status === 'planned');
