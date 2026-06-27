begin;

create temporary table target_courses on commit drop as
select id
from public.courses;

create temporary table target_classes on commit drop as
select c.id
from public.classes c
join target_courses tc on tc.id = c.course_id;

delete from public.permission_scopes
where (scope_type = 'course' and scope_id in (select id from target_courses))
   or (scope_type = 'class' and scope_id in (select id from target_classes));

delete from public.course_change_requests;

delete from public.class_change_requests;

delete from public.enrollment_requests
where course_id in (select id from target_courses)
   or class_id in (select id from target_classes);

delete from public.course_assessment_results
where course_id in (select id from target_courses)
   or class_id in (select id from target_classes);

delete from public.question_bank_items
where course_id in (select id from target_courses);

delete from public.simulations
where course_id in (select id from target_courses);

delete from public.student_course_stats
where course_id in (select id from target_courses);

delete from public.materials
where course_id in (select id from target_courses);

delete from public.assessments
where course_id in (select id from target_courses)
   or class_id in (select id from target_classes);

delete from public.classes
where id in (select id from target_classes);

delete from public.courses
where id in (select id from target_courses);

commit;
