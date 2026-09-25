import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'delete expired application data',
  { hourUTC: 2, minuteUTC: 15 },
  internal.maintenance.deleteExpiredData
)

// <convexkit:files>
crons.hourly(
  'delete abandoned uploads',
  { minuteUTC: 30 },
  internal.files.deleteAbandonedUploads,
  {}
)
// </convexkit:files>

export default crons
