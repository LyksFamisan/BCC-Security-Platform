import {createHostedHandler} from '../backend/src/hosted-handler.js'
import {pool} from '../backend/src/db.js'
export default createHostedHandler(pool,process.env.JWT_SECRET)
