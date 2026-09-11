import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth.constants';

/**
 * Opts a route out of the globally applied auth guard. Authentication is the
 * default, so forgetting a guard can no longer leave an endpoint open - you
 * have to state the exception explicitly.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
