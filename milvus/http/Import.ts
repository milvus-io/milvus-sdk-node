import { HttpBaseClient } from '../HttpClient';
import {
  HttpBaseResponse,
  HttpImportJobReq,
  Constructor,
  FetchOptions,
  HttpImportListResponse,
  HttpImportListReq,
  HttpImportCreateReq,
  HttpImportCreateResponse,
  HttpImportProgressReq,
  HttpImportProgressResponse,
} from '../types';

/**
 *
 * @param {Constructor<HttpBaseClient>} Base - The base class to be extended.
 * @returns {class} - The extended class with additional methods for collection management.
 *
 * @method listImportJobs - Lists all import jobs.
 * @method createImportJobs - Creates new import jobs.
 * @method getImportJobProgress - Retrieves the progress of an import job.
 */
export function Import<T extends Constructor<HttpBaseClient>>(Base: T) {
  return class extends Base {
    get importPrefix() {
      return '/vectordb/jobs/import';
    }

    async listImportJobs(params: HttpImportListReq, options?: FetchOptions) {
      const url = `${this.importPrefix}/list`;
      return await this.POST<HttpImportListResponse>(url, params, options);
    }

    async createImportJobs(
      params: HttpImportCreateReq,
      options?: FetchOptions
    ) {
      const url = `${this.importPrefix}/create`;
      return await this.POST<HttpImportCreateResponse>(url, params, options);
    }

    async getImportJobProgress(
      params: HttpImportProgressReq,
      options?: FetchOptions
    ) {
      const url = `${this.importPrefix}/get_progress`;
      return await this.POST<HttpImportProgressResponse>(url, params, options);
    }

    /** Commit a manual import in the Uncommitted state. */
    async commitImportJob(params: HttpImportJobReq, options?: FetchOptions) {
      return await this.POST<HttpBaseResponse>(
        `${this.importPrefix}/commit`,
        params,
        options
      );
    }

    /** Abort an import before it commits. */
    async abortImportJob(params: HttpImportJobReq, options?: FetchOptions) {
      return await this.POST<HttpBaseResponse>(
        `${this.importPrefix}/abort`,
        params,
        options
      );
    }
  };
}
