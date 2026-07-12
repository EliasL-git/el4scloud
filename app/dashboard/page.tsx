'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { HardDrive, Plus, ExternalLink } from 'lucide-react'
import { getStorageResource } from '@/app/actions/dashboard'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

interface Resource {
  name: string
  type: string
  status: string
  usageBytes: number
  totalFiles: number
  limitBytes: number
}

export default function DashboardOverview() {
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStorageResource()
      .then(setResource)
      .catch(() => setResource(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* Welcome Banner */}
      <div className="relative overflow-hidden glass-card rounded-2xl p-10 mb-10 flex flex-col lg:flex-row items-center justify-between border-primary/10">
        <div className="relative z-10 max-w-2xl text-center lg:text-left mb-6 lg:mb-0">
          <h2 className="text-3xl sm:text-[32px] font-heading font-bold text-on-primary-container mb-4 tracking-tight leading-tight">
            Welcome to your Hobbycloud Workspace
          </h2>
          <p className="text-on-surface font-sans opacity-80 leading-relaxed">
            Orchestrate your high-performance infrastructure from a single unified command center. Get started by uploading a file or managing your storage bucket.
          </p>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/dashboard/storage"
            className="px-8 py-3.5 bg-primary text-on-primary rounded-2xl font-bold hover:shadow-[0_0_20px_rgba(213,227,255,0.25)] transition-all active:scale-95 whitespace-nowrap text-sm inline-flex items-center justify-center"
          >
            Upload Files
          </Link>
          <Link
            href="/dashboard/settings"
            className="px-8 py-3.5 border border-primary/40 text-primary rounded-2xl font-bold hover:bg-primary/5 transition-all active:scale-95 whitespace-nowrap text-sm inline-flex items-center justify-center"
          >
            Upgrade Storage
          </Link>
        </div>
      </div>

      {/* Resources Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-heading font-bold text-on-surface">Project Resources</h3>
          <p className="text-on-surface-variant text-sm mt-1">
            Active services in <span className="text-primary font-semibold">Default Project</span>
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard/storage" className="text-primary hover:text-primary-fixed transition-colors">
            Upload Files
          </Link>
          <div className="size-1.5 bg-outline-variant/50 rounded-full" />
          <Link href="/dashboard/storage" className="text-on-surface-variant hover:text-on-surface transition-colors">
            Manage
          </Link>
        </div>
      </div>

      {/* Resources Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-highest/40 border-b border-outline-variant/30">
              <tr>
                <th className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-70 uppercase tracking-widest">Name</th>
                <th className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-70 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-70 uppercase tracking-widest">Usage</th>
                <th className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-70 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-70 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-sm text-on-surface-variant">
                    Loading resources...
                  </td>
                </tr>
              ) : resource ? (
                <tr className="hover:bg-primary/5 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-primary/10 p-2 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <HardDrive className="size-5 text-primary" />
                      </div>
                      <span className="font-semibold text-on-surface">{resource.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-on-surface-variant">{resource.type}</td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1 max-w-[180px]">
                      <div className="flex justify-between text-xs text-on-surface-variant">
                        <span>{formatBytes(resource.usageBytes)}</span>
                        <span>{formatBytes(resource.limitBytes)}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min((resource.usageBytes / (resource.limitBytes || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-on-surface-variant/60">{resource.totalFiles} file{resource.totalFiles !== 1 ? 's' : ''}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-full bg-success-primary glow-status" />
                      <span className="text-sm font-bold text-on-surface">{resource.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Link
                      href="/dashboard/storage"
                      className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded-xl transition-all inline-flex"
                    >
                      <ExternalLink className="size-5" />
                    </Link>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-sm text-on-surface-variant">
                    No resources found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-5 bg-surface-container-highest/20 text-center border-t border-outline-variant/20">
          <Link href="/dashboard/storage" className="text-on-surface-variant hover:text-primary transition-all flex items-center gap-2 mx-auto text-sm font-bold">
            <Plus className="size-[18px]" />
            Upload files to your storage
          </Link>
        </div>
      </div>
    </div>
  )
}
