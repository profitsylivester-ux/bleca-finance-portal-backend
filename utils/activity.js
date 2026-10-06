import Activity from '../models/Activity.js'

export async function logActivity(user, action, details = '') {
  try {
    await Activity.create({
      user: user.userId,
      userName: user.name,
      action,
      details,
    })
  } catch (error) {
    console.error('Activity log error:', error)
  }
}
