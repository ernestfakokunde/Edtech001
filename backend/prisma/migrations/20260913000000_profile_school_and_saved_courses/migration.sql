-- The profile keeps the school (university + faculty) so a student enters it
-- once; courses are added afterwards with just a code and title.
ALTER TABLE "Profile" ADD COLUMN "universityId" TEXT;
ALTER TABLE "Profile" ADD COLUMN "facultyId" TEXT;

-- Student-saved courses for quick personal uploads and AI generation.
CREATE TABLE "ProfileCourse" (
    "profileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCourse_pkey" PRIMARY KEY ("profileId","courseId")
);

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfileCourse" ADD CONSTRAINT "ProfileCourse_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileCourse" ADD CONSTRAINT "ProfileCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Profile_universityId_idx" ON "Profile"("universityId");
CREATE INDEX "Profile_facultyId_idx" ON "Profile"("facultyId");
CREATE INDEX "ProfileCourse_courseId_idx" ON "ProfileCourse"("courseId");